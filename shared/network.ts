// A browser cannot observe WebSocket control-frame pings. Application heartbeats
// bound silent failures in both the lobby and a fight, including a stuck close.
export const NETWORK_HEARTBEAT_MS = 2_000;
export const NETWORK_TIMEOUT_MS = 8_000;
export const MAX_CLIENT_BUFFER_BYTES = 64 * 1024;
// Inputs normally arrive at least every 45 ms. Keep a generous jitter margin,
// then release held directions instead of moving forever on the last packet.
export const INPUT_TIMEOUT_MS = 1_000;
