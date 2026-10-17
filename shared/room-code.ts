export const ROOM_CODE_LENGTH = 32;

export function normalizeRoomCode(code: string) {
  return code.trim().toUpperCase();
}

export function isRoomCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9A-F]{32}$/i.test(normalizeRoomCode(value))
  );
}
