# Online roster review v41

## Result

No confirmed online server failure was found for the eight new fighters in the tested paths. The added real-WebSocket tests pass.

## Coverage

`tests/adversarial-online-roster-v41.test.ts` exercises the production `makeArenaServer` and `/ws` handlers using HTTP port `0` on loopback. Each fixture uses a temporary creator data directory, an in-memory SQLite database, and `provider: null`; it does not use the project data directory or call a generation provider.

The first case runs nine real online matches, one for each stage. All eight IDs—Javier, Dayana, Nacho, Capriles, Lorenzo, Carolina, Bolívar, and Edgar—appear as both creator and joiner and are selected in the lobby. It checks that the joiner's stage proposal is ignored, the host can change stage, a host change clears readiness, both clients receive the same started match, and both players' special-action counters reach the shared simulation. One matchup is finished and rematched; a packet carrying the old match ID is rejected and a fresh packet is accepted.

The second case runs two simultaneous new-fighter rooms. It sends malformed JSON, an incomplete action map, a stale match ID, and a match ID belonging to the other room. These packets do not move either room. A valid input moves only its own match. After one guest disconnects, a new WebSocket can join the waiting room by code and start a fresh match with the same stage and fighter selection; the other room continues to accept input.

The tests use the actual socket parser, room handlers, and simulation tick. After the server emits `start`, they set the in-process match phase to `playing` and adjust starting energy, position, and invincibility so the network input paths can be exercised without waiting through each presentation countdown. The rejoin case checks room-code reentry through a new socket; the protocol does not preserve a disconnected socket's identity or provide account-level session resume.

## Verification

- `npx tsx --test tests/adversarial-online-roster-v41.test.ts` — 2 passed, 0 failed.
- `npx tsc --noEmit` — passes after correcting the map type in the parallel renderer regression. The initial run caught that test-only type error; it is resolved.
- No production runtime files were changed.
