# Private character generation with ChatGPT and Codex

This is an operator-run asset workflow for development, `prod-tst`, and private use on the Oracle host. The game server does not run Codex, accept ChatGPT tokens, or expose a generation proxy. The SDK is a pinned development dependency; the game image includes only the asset importer. The [Oracle operator installation](codex-operator-oracle.md) runs Codex in a separate container with its own private storage.

**Current configuration:** the owner authorizes ChatGPT subscription allowance followed by existing ChatGPT/Codex credits. `ARENA_CODEX_BILLING_POLICY=chatgpt-plan-and-credits` is the default. Each design and drawing-instruction turn explicitly selects `gpt-6-luna` and `modelReasoningEffort: "high"`; no default model is inherited. The built-in image tool renders pixels with `gpt-image-2`. Codex uses included allowance before credits. Setting `credits-only` still blocks generation because it cannot be enforced upstream. [Usage accounting](https://learn.chatgpt.com/docs/pricing#how-does-image-generation-count-toward-usage-limits), [models](https://learn.chatgpt.com/docs/models), [image generation](https://learn.chatgpt.com/docs/image-generation)

## Login

Run these commands in the same workspace terminal where generation will run:

```bash
npm ci
npm run creator:codex -- doctor
```

The doctor reports `"authentication":"chatgpt"`, `"model":"gpt-6-luna"` and `"reasoningEffort":"high"` when configured correctly. If login is missing:

```bash
npm run creator:codex -- login
```

Open the verification link printed in the terminal, sign in to your ChatGPT account, and enter the one-time code there. If device login is unavailable, enable it under ChatGPT security settings or use `codex login` on a machine with a browser. Run the doctor again afterward. Never paste a password, token, API key, or `auth.json` into chat, and never mount the login cache into the game container. [Official authentication instructions](https://learn.chatgpt.com/docs/auth#login-on-headless-devices)

The helper requires ChatGPT authentication and removes API keys and other application secrets from its child environment. `ARENA_CODEX_PATH` can select a different installed CLI executable. The tested SDK/CLI version is `0.162.1`; an available built-in image tool and sufficient account usage are still required. Built-in images consume Codex usage; exact credit deductions are not calculated by this helper. [Image generation](https://learn.chatgpt.com/docs/image-generation), [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)

## Generate and review

Create a character input file, for example `data/creator-codex/input.json`:

```json
{
  "name": "Pana orbital",
  "description": "Chaqueta blanca, pantalón blanco y botas oscuras. Combate ágil y teatral.",
  "style": "agile",
  "color": "#ee7c34"
}
```

Create the parent `data/creator-codex` directory before writing the input. Styles are `agile`, `technical`, and `power`. Supply one to three reference photos; each must be JPG, PNG or WebP, at most 8 MB and 20 million pixels. Face-only, upper-body, cropped and occluded references are accepted. The prompt preserves visible features and distinguishes a photograph's crop from a visible anatomical difference. Unseen clothing is completed as fictional design, consistently across all poses.

```bash
npm run creator:codex -- generate \
  --input data/creator-codex/input.json \
  --photo /private/photos/upper-body.jpg \
  --job data/creator-codex/first-character
```

Repeat `--photo` for additional references. Each command uses a new private job directory and performs one Luna High design turn and one Luna High drawing-instruction turn. Image generation is disabled during design and enabled during drawing. The SDK runs with read-only filesystem permissions, shell execution, hooks and plugins disabled, configured MCP servers explicitly disabled, shell networking and web search disabled, and no API fallback. MCP configuration is enumerated locally without logging its contents; an enumeration failure stops that turn before inference. Read-only access alone would permit credential reads, so it is not the credential boundary.

The adapter requires terminal `turn.completed`, validates the structured response, and always selects exactly one fresh regular `exec-*.png` from that completed thread's own directory, regardless of the assistant's returned path. Missing, old, ambiguous or symlinked receipts are rejected. This receipt recovery does not make a model request. The game packer then checks transparency, eight nonempty distinct cells, clipping and margins, followed by simulated combat from both sides.

Jobs inside this workspace must be under `data/`, which is excluded from Git, Docker and the development web server. A private directory outside the workspace is also accepted. Generation and manual repacking both reject web-served locations and symlinks into them. References and bundle files must be regular files, not symlinks. The hardened file workflow is verified on Linux with `/proc/self/fd`; other descriptor filesystems are not release-verified. Operator storage and Codex configuration must remain trusted and private; these checks do not isolate a malicious process running as the same operating-system user.

Review `bundle/sprite.png`, `bundle/portrait.webp` and `bundle/character.json`. Check likeness, outfit consistency, complete bodies, pose order, right-facing orientation and unwanted text. Automated checks cannot establish those visual qualities. Reference photos and request metadata remain outside `bundle/`; transfer **only `bundle/`** to staging.

The application never automatically starts a replacement generation turn or overwrites an existing job. Unbounded Codex connection retries are disabled. Finite HTTP/SSE transport retries inside the pinned native CLI remain controlled upstream: it rejects overrides of its built-in OpenAI provider, so this helper cannot promise zero transport replay. An interrupted request may have consumed usage. A failed generation records `status.json`; completed design and raw art remain available for inspection. If only packing needs to be rerun, this command makes no model request:

```bash
npm run creator:codex -- pack --job data/creator-codex/first-character
```

Before packing, the helper isolates eight complete alpha silhouettes and places them in separate cells with one shared scale. This accommodates a whole boot, hand or jump silhouette crossing an internal grid line without cutting it off. Missing, merged, fragmented, exactly repeated or canvas-cropped figures are rejected, as are silhouette centers that do not occupy the eight grid positions once each. Semantic pose order, likeness and anatomy still require visual review. It preserves generated pixels and their soft edges; it does not paint or reconstruct anatomy. `bundle/normalization.json` records the original bounds. Staging repeats this operation from the checksummed original rather than trusting packed assets.

No `bundle/manifest.json` is written until packing and combat validation succeed. Repacking revokes an older manifest before reading edited metadata; a failed or cancelled pack leaves no importable manifest. If a new image is needed, deliberately start a new job; this spends additional plan usage. The helper does not bypass account or workspace limits.

## Import into prod-tst

Create the target owner account through the staging app first. Importing does not create accounts or publish a character. With the bundle copied to a private path on the staging host, run the importer inside the staging container's runtime (or an equivalent operator environment with Node 24 and project dependencies):

```bash
ARENA_ENVIRONMENT=prod-tst \
ARENA_DATA_DIR=/private/prod-tst/creator \
npm run creator:import -- \
  --bundle /private/import/bundle \
  --owner-email owner@example.com
```

`ARENA_DATA_DIR` must point at the staging app's existing creator data directory. The importer requires the staging environment, resolves the existing owner, validates input/design/checksum, rejects symlinked bundle files, storage directories or SQLite files and duplicate IDs, repacks the source, tests combat, and commits a `ready` draft. Directory descriptors pin file operations while bounded no-follow reads prevent source-path swaps. SQLite and its private directory must remain under the trusted staging user's control. The importer does not trust prepacked geometry or owner information in an exported character file. Use the app's normal **Probar** and **Publicar** actions to review and publish the imported draft. Keep test characters confined to staging.

For the supplied Oracle deployment, the host data directory is `/var/lib/arena-criolla-prod-tst/creator`, mounted as `/app/data/creator` in `arena-criolla-prod-tst`. Copy the bundle into `/tmp/creator-import/<job>` in that container, then run:

```bash
sudo docker exec -e ARENA_ENVIRONMENT=prod-tst arena-criolla-prod-tst \
  npm run creator:import -- \
  --bundle /tmp/creator-import/first-character \
  --owner-email owner@example.com
```

Delete the temporary transferred bundle after successful import. The database and final character files remain in staging's persistent volume.

## Checks and scope

`npm test` includes the offline workflow, privacy, cancellation, stale/external image rejection, invalid atlas rejection, checksum checks, owner resolution, duplicate protection and import-to-publication service checks. These use deterministic fixtures and do not spend credits.

Native Codex authentication is distinct from the public Sign in with ChatGPT API preview. The public preview currently excludes image generation, and native app-server authentication is not permitted for commercial or hosted services. This tool prepares private development assets; it is not a hosted image backend. [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations), [Native authentication scope](https://learn.chatgpt.com/docs/app-server#auth-endpoints)
