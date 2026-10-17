# Automatic visitor character generation

The public website uses the server-side OpenAI API provider in `server/creator/provider.ts`. A signed-in Arena Criolla visitor uploads one to three photographs, receives a private generated draft, tests it, and can publish it. Their ChatGPT account is not used for authentication. The native Codex SDK tool remains a private development workflow.

The Oracle host also has a separate [private Codex operator workflow](codex-operator-oracle.md), with a verified ChatGPT login and a successful actual generation. It uses GPT-6 Luna with high reasoning for each Codex turn, with the owner's authorization to consume subscription allowance followed by credits. The image tool renders with gpt-image-2. Installing it does not enable the public visitor pipeline or connect ChatGPT credentials to the game.

## Billing prerequisite

The existing service-account key authenticated successfully, but an actual Responses request returned HTTP 429 with `credit_balance_exhausted` on 2026-10-17. Add a usable API balance to the organization owning that key at [OpenAI Platform billing](https://platform.openai.com/settings/organization/billing/). The Work/Codex credits shown in ChatGPT do not fund this API-key route. No new key type is required.

An authenticated model listing or a configured key is insufficient proof of working generation. Before admitting public generation, finish an actual staging request through design, image editing, sprite validation and combat testing. `gpt-image-2` transparent output is documented as a preview capability; availability must be verified for this API organization. [Image editing](https://developers.openai.com/api/reference/resources/images/methods/edit)

## Production configuration

The deployment template is `deploy/production.compose.yaml`. On Oracle, production uses `/opt/arena-criolla/compose.yaml`, the root-owned secret file `/etc/arena-criolla/server.env` (mode 600), and persistent storage `/var/lib/arena-criolla`, mounted at `/app/data`.

Set these server-only variables in the secret file:

```dotenv
OPENAI_API_KEY=<existing project service-account key>
OPENAI_DESIGN_MODEL=gpt-4.1-mini
OPENAI_IMAGE_MODEL=gpt-image-2
ARENA_CREATOR_ENABLED=false
```

Keep `ARENA_CREATOR_ENABLED=false` until the real staging generation passes. The default is also disabled when the variable is absent. This disables admission even when a key exists; `/api/creator/capabilities` reports `generationAvailable:false`. Invalid boolean values fail startup instead of silently enabling requests. No key is sent to a browser or included in the built image.

The initial production limits are one concurrent generation, four admitted jobs, ten attempts in a rolling 24-hour period globally and six per user. These are attempt caps, not dollar budgets. Reference photos may be face-only, upper-body, cropped or occluded. Image output must contain complete separate figures and rejects exactly repeated poses; the packing fallback moves whole generated silhouettes across internal grid lines without reconstructing missing anatomy. Semantic pose order and likeness require visual review. Original paid image responses stay cached. The public API SDK has automatic retries disabled; the private Codex CLI has a separate upstream transport-retry limitation documented in its workflow guide.

## Activation and verification

After API billing is funded:

1. Complete a real character through the isolated `prod-tst` API pipeline and inspect all eight poses.
2. Change `ARENA_CREATOR_ENABLED=true` in `/etc/arena-criolla/server.env`.
3. Recreate production with `sudo docker compose -f /opt/arena-criolla/compose.yaml up -d --no-build --force-recreate --wait`.
4. Check `/api/health`, `/api/creator/capabilities`, account access and the character workshop on the public domain.
5. Complete one real production generation under a temporary test account, verify ownership and private assets, and remove its test data afterward.

If billing, model access or transparency fails, leave public generation disabled. A live capability check reports configuration and worker availability; it does not poll OpenAI billing on every page load. Keep monitoring generation failures and set the switch false if upstream access is lost.

The release process builds a new image before replacing the running service, backs up production data and the prior deployment configuration, and retains the previous image/release for rollback. Readiness and any outstanding prerequisite are recorded in `docs/production-creator-qa.json`.

## Leaving and returning to the workshop

The signed-in account's unfinished form, selected style/color and reference-photo blobs are saved in IndexedDB on the same browser profile. The UI reports when the draft is saved and offers a discard action. Clearing site data, browser eviction or changing devices can remove an unsubmitted draft. Accepted jobs are stored in SQLite and continue on the server while the page is closed. Returning, refocusing or reconnecting refreshes their status.

The browser persists a UUID before sending a creation request and sends it as `Idempotency-Key`. Replaying an accepted request returns that owner's existing job, even if the original response was lost or the server restarted. It does not repeat model calls or admission budgets. Each account has its own draft and request namespace. A server interruption during generation exposes a failed job for explicit continuation, without automatically repeating a potentially billed image request. See `creator-state-qa.json` for the browser and service checks.

While a creation response is pending, the saved form stays fixed. **Comprobar mi creación** deliberately resends the same request; it does not start an automatic paid retry. **Descartar borrador** first records a server cancellation so a delayed original upload cannot create another job. An already accepted job remains in **Mis luchadores**. Deleted and cancelled requests retain their receipts and return HTTP 410 on replay. Multipart replays must match the accepted input and photo bytes; an authenticated empty POST with the same key recovers an existing job without reuploading photos, including with generation disabled. Legacy accepted jobs verify matching normalized photos before binding their first body fingerprint; empty recovery remains available if those photos are unavailable.

The updated browser binds private requests to the account displayed in the tab. A changed or expired session returns to sign-in, preserving that account's local draft. Cross-tab auth changes also invalidate delayed initialization and sign-in responses. Older browser bundles without the owner header retain ordinary cookie authentication and should be reloaded to receive this protection. A stale tab cannot overwrite or discard a newer saved draft; it offers **Recuperar borrador guardado** when another tab changed it. New cancellation receipts have separate rolling daily limits of four times the configured global and per-user generation-attempt caps; existing receipts can still be recovered or discarded after that limit. Receipts are retained to prevent delayed paid replays, so include them in normal SQLite backups and storage monitoring.
