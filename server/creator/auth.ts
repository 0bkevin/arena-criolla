import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import type { CreatorDatabase } from "./database";

const derive = promisify(scrypt);
const COOKIE = "arena_session";
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await derive(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [, salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = (await derive(password, salt, 64)) as Buffer;
  const reference = Buffer.from(expected, "hex");
  return (
    actual.length === reference.length && timingSafeEqual(actual, reference)
  );
}
export function sessionToken(req: Request) {
  const value = req.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function currentUser(req: Request, db: CreatorDatabase) {
  const token = sessionToken(req);
  return token ? db.session(tokenHash(token)) : undefined;
}
export function createSession(
  res: Response,
  db: CreatorDatabase,
  userId: string,
  secure: boolean,
) {
  const token = randomBytes(32).toString("hex");
  db.saveSession(
    tokenHash(token),
    userId,
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  );
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}
export function clearSession(res: Response, secure: boolean) {
  res.clearCookie(COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
  });
}
