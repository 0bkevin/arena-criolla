import type {
  CommunityCharacter,
  CreatorCapabilities,
  CreatorCharacter,
  CreatorUser,
} from "../shared/creator";

export class CreatorRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}
export const creatorSessionEvent = "arena-creator-session";
function announceSessionChange() {
  try {
    localStorage.setItem(creatorSessionEvent, crypto.randomUUID());
  } catch {
    /* Storage can be disabled. The next authenticated request still checks ownership. */
  }
}
const ownerHeaders = (owner?: string): Record<string, string> =>
  owner ? { "X-Creator-Owner": owner } : {};

export async function creatorRequest<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const connectionError = () =>
    new Error(
      "No pudimos conectar con el taller. Revisa tu conexión y vuelve a intentar.",
    );
  const response = await fetch(url, {
    credentials: "same-origin",
    signal: AbortSignal.timeout(45_000),
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  }).catch((error: unknown) => {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    )
      throw error;
    throw connectionError();
  });
  const body = await response.json().catch(() => {
    throw connectionError();
  });
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw connectionError();
  if (!response.ok)
    throw new CreatorRequestError(
      typeof body.error === "string" && body.error
        ? body.error
        : "No pudimos completar esa acción.",
      response.status,
      typeof body.code === "string" ? body.code : undefined,
    );
  return body as T;
}
export const creatorApi = {
  session: () =>
    creatorRequest<{ user: CreatorUser | null }>("/api/auth/session"),
  signIn: async (email: string, password: string) => {
    const data = await creatorRequest<{ user: CreatorUser }>(
      "/api/auth/signin",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
    announceSessionChange();
    return data;
  },
  signUp: async (name: string, email: string, password: string) => {
    const data = await creatorRequest<{ user: CreatorUser }>(
      "/api/auth/signup",
      {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      },
    );
    announceSessionChange();
    return data;
  },
  signOut: async (owner?: string) => {
    await creatorRequest("/api/auth/signout", {
      method: "POST",
      headers: ownerHeaders(owner),
    });
    announceSessionChange();
  },
  capabilities: () =>
    creatorRequest<CreatorCapabilities>("/api/creator/capabilities"),
  mine: (owner?: string) =>
    creatorRequest<{ characters: CreatorCharacter[] }>(
      "/api/creator/characters",
      { headers: ownerHeaders(owner) },
    ),
  create: (body: FormData, requestKey?: string, owner?: string) =>
    creatorRequest<{ character: CreatorCharacter }>("/api/creator/characters", {
      method: "POST",
      headers: {
        ...ownerHeaders(owner),
        ...(requestKey ? { "Idempotency-Key": requestKey } : {}),
      },
      body,
    }),
  discardRequest: (key: string, owner: string) =>
    creatorRequest<{ character: CreatorCharacter | null }>(
      `/api/creator/requests/${key}`,
      { method: "DELETE", headers: ownerHeaders(owner) },
    ),
  retry: (id: string, owner?: string) =>
    creatorRequest<{ character: CreatorCharacter }>(
      `/api/creator/characters/${id}/retry`,
      { method: "POST", headers: ownerHeaders(owner) },
    ),
  publish: (id: string, owner?: string) =>
    creatorRequest<{ character: CreatorCharacter }>(
      `/api/creator/characters/${id}/publish`,
      { method: "POST", headers: ownerHeaders(owner) },
    ),
  remove: (id: string, owner?: string) =>
    creatorRequest(`/api/creator/characters/${id}`, {
      method: "DELETE",
      headers: ownerHeaders(owner),
    }),
  community: () =>
    creatorRequest<{ characters: CommunityCharacter[] }>(
      "/api/community/characters",
      { signal: AbortSignal.timeout(5000) },
    ),
};
