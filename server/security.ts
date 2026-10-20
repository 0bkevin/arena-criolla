import { randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { RequestHandler } from "express";

type TrustProxy = (address: string, hop: number) => boolean;

/** Use the same proxy boundary as Express; never trust a forwarded Host. */
function requestOrigin(request: IncomingMessage, trustProxy: TrustProxy) {
  const host = request.headers.host;
  if (!host || /[\s\\/#?@"'<>`,;]/.test(host)) return undefined;
  let protocol =
    "encrypted" in request.socket && request.socket.encrypted === true
      ? "https"
      : "http";
  if (trustProxy(request.socket.remoteAddress ?? "", 0)) {
    const forwarded = request.headers["x-forwarded-proto"];
    if (typeof forwarded === "string") {
      const value = forwarded.split(",", 1)[0].trim();
      if (value === "http" || value === "https") protocol = value;
    }
  }
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return undefined;
  }
}

export function allowedWebSocketOrigin(
  request: IncomingMessage,
  trustProxy: TrustProxy,
) {
  const origin = request.headers.origin;
  // Native clients have no browser credentials or cross-site origin. Keep guest
  // tooling supported; Origin validation is not authentication or a bot filter.
  if (origin === undefined) return true;
  return origin === requestOrigin(request, trustProxy);
}

export function securityHeaders(
  production: boolean,
  trustProxy: TrustProxy,
): RequestHandler {
  return (req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy":
        "camera=(), microphone=(), geolocation=(), fullscreen=(self), gamepad=(self)",
    });
    if (req.secure) res.set("Strict-Transport-Security", "max-age=31536000");
    if (production) {
      const nonce = randomBytes(24).toString("base64");
      res.locals.cspNonce = nonce;
      const origin = requestOrigin(req, trustProxy);
      const websocket = origin?.replace(/^http/, "ws");
      res.set(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          `script-src 'self' 'nonce-${nonce}'`,
          // React's dynamic positioning and animation use inline style values.
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "media-src 'self' data: blob:",
          "font-src 'self'",
          `connect-src 'self'${websocket ? ` ${websocket}` : ""}`,
          "frame-src 'none'",
          "object-src 'none'",
          "base-uri 'none'",
          "frame-ancestors 'none'",
          "form-action 'self'",
        ].join("; "),
      );
    }
    next();
  };
}
