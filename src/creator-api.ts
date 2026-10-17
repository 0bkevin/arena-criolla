import type {
  CommunityCharacter,
  CreatorCapabilities,
  CreatorCharacter,
  CreatorUser,
} from "../shared/creator";

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
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  }).catch(() => {
    throw connectionError();
  });
  const body = await response.json().catch(() => {
    throw connectionError();
  });
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw connectionError();
  if (!response.ok)
    throw new Error(
      typeof body.error === "string" && body.error
        ? body.error
        : "No pudimos completar esa acción.",
    );
  return body as T;
}
export const creatorApi = {
  session: () =>
    creatorRequest<{ user: CreatorUser | null }>("/api/auth/session"),
  signIn: (email: string, password: string) =>
    creatorRequest<{ user: CreatorUser }>("/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  signUp: (name: string, email: string, password: string) =>
    creatorRequest<{ user: CreatorUser }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  signOut: () => creatorRequest("/api/auth/signout", { method: "POST" }),
  capabilities: () =>
    creatorRequest<CreatorCapabilities>("/api/creator/capabilities"),
  mine: () =>
    creatorRequest<{ characters: CreatorCharacter[] }>(
      "/api/creator/characters",
    ),
  create: (body: FormData) =>
    creatorRequest<{ character: CreatorCharacter }>("/api/creator/characters", {
      method: "POST",
      body,
    }),
  retry: (id: string) =>
    creatorRequest<{ character: CreatorCharacter }>(
      `/api/creator/characters/${id}/retry`,
      { method: "POST" },
    ),
  publish: (id: string) =>
    creatorRequest<{ character: CreatorCharacter }>(
      `/api/creator/characters/${id}/publish`,
      { method: "POST" },
    ),
  remove: (id: string) =>
    creatorRequest(`/api/creator/characters/${id}`, { method: "DELETE" }),
  community: () =>
    creatorRequest<{ characters: CommunityCharacter[] }>(
      "/api/community/characters",
      { signal: AbortSignal.timeout(5000) },
    ),
};
