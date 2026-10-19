# Melanio v45 network movement review

## Findings

No product issue reproduced in the exercised WebSocket movement and action paths. Confidence: medium to high for the covered cases; this is an integration probe, not a full network stress test.

The tests exercise Melanio as both room host and guest. They cover left and right movement, jump, light, heavy, and the returning signal special; duplicate and lower action counters; an empty input packet releasing held movement; stale input after rematch; and isolation while a second room advances. Both clients receive identical serialized state for the returned signal tick, including its owner and reversed direction.

Severity: none assigned. No player-visible Melanio network regression was found, so there is no product finding to report with a file line or concrete failure consequence.

## Harness notes

The first probes exposed test setup assumptions rather than product failures. Melanio's seat must change in the room's fighter configuration while host and guest connections remain fixed. Action counters are monotonic within a match, so neutral movement packets retain the current counters. Attack presses sent during recovery cooldown are consumed even if the attack animation has cleared; the probe waits for cooldown zero. Network serialization omits optional projectile properties whose values are `undefined`, so client snapshots are compared with each other rather than with the in-memory server object. Reused peers require matching rooms by a unique name and state snapshots by both match ID and tick to avoid stale notifications.

The integration harness creates a real ephemeral localhost server with an in-memory SQLite database, a `null` provider, and workshop disabled. Its data directory uses the OS temporary directory (`TMPDIR=/dev/shm` in the final focused run), so the fixture remains portable. Fixtures close sockets, server, and directory in `finally` blocks.

## Verification

Command: `npx tsx --test tests/melanio-online-v45.test.ts`

Result: 3 passed, 0 failed. The three cases completed in about 8 seconds total; per-case WebSocket waits are bounded at 4 seconds.

**RISKIEST LINE:** `tests/melanio-online-v45.test.ts:278` looks up the matching tick from the host's queued snapshots; because the server publishes every other simulation tick, this confirms serialized parity at a sampled tick rather than every intermediate frame.
