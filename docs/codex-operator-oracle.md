# Private Codex on the Oracle production host

Codex CLI and SDK `0.162.1` run as a manually invoked operator tool, separate from the public game. The tool requires ChatGPT authentication, removes API keys from the child environment, forces `forced_login_method: "chatgpt"`, and has no API fallback. ChatGPT plan allowance is used before available ChatGPT/Codex credits. [Official authentication](https://learn.chatgpt.com/docs/auth), [usage accounting](https://learn.chatgpt.com/docs/pricing#how-does-image-generation-count-toward-usage-limits)

**Current state:** Oracle ChatGPT sign-in is verified. The owner now authorizes subscription allowance followed by existing credits. Both Codex phases explicitly select `gpt-6-luna` with high reasoning; the image tool uses `gpt-image-2` to render the artwork. The previous credits-only restriction is superseded. Exact account deductions are not measured by this helper.

This installation does not enable automatic generation from visitors' uploads. Native app-server authentication is not permitted for hosted services, and the public Sign in with ChatGPT preview currently excludes image generation. The public game's API provider remains disabled. [Native authentication scope](https://learn.chatgpt.com/docs/app-server#auth-endpoints), [preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)

## Installation

From a copy of this source tree on the Oracle host:

```bash
sudo bash deploy/install-codex-operator.sh
sudo arena-codex version
```

The installer builds `arena-criolla:codex-operator-v6`, creates the `arena-codex` system user, and installs `/usr/local/bin/arena-codex`. It does not restart the game. The runtime uses a read-only root filesystem, no published ports, dropped Linux capabilities, no new privileges, one CPU and 2 GB of memory. Only `/var/lib/arena-codex` is mounted, as `/operator`. The app's database, reference photos, API secret file, and Docker socket are not mounted. No web route, daemon, scheduler or visitor queue invokes this tool.

Private operator directories and the login cache are owned by `arena-codex`, with mode `0700`. Docker receives explicit environment values; no host API keys are passed through. Removing the container after a command preserves the private job files and ChatGPT login in this directory.

## Sign in

In an SSH terminal on Oracle, run:

```bash
sudo arena-codex login
```

Open the official verification URL printed by Codex in your own browser, sign in to the ChatGPT account containing your credits, and enter the one-time code on that page. If required, enable device-code login in ChatGPT's security settings. Enter credentials only on the official sign-in page. Do not copy this workspace's login cache to Oracle or send credentials in chat.

Then check:

```bash
sudo arena-codex doctor
```

The successful result includes `"authentication":"chatgpt"`. The existing Oracle login has been verified. A missing, expired or API-key login stops generation; it never switches to the game's service-account key. The doctor also confirms `gpt-6-luna` and `high`. OpenAI uses subscription allowance before credits; this tool does not change that billing order.

## Generate privately

The command below uses the existing ChatGPT login. Each of its two Codex reasoning turns is pinned to Luna High. The application makes no automatic replacement generation turn or API-key fallback. Image generation is enabled only for the drawing turn; shell execution, hooks, plugins and configured MCP servers are disabled. See [the workflow guide](creator-codex.md) for the bounded workflow, native CLI transport-retry limitation and trusted operator configuration boundary.

Place your character JSON and one to three reference photos in the private operator directories using `sudo install -o arena-codex -g arena-codex -m 600`. Files in `/var/lib/arena-codex/inputs` and `/var/lib/arena-codex/photos` appear at `/operator/inputs` and `/operator/photos` inside the container.

```bash
sudo arena-codex generate \
  --input /operator/inputs/character.json \
  --photo /operator/photos/upper-body.jpg \
  --job /operator/jobs/my-first-character
```

Use a new job path each time. Face-only, upper-body, cropped and occluded photos are accepted; generated art must still pass the complete-body, eight-pose and combat checks described in [the workflow guide](creator-codex.md). Review the art manually for likeness, anatomy, consistent clothing and pose order. The finished bundle is stored on the host at `/var/lib/arena-codex/jobs/my-first-character/bundle`.

Packing an existing job makes no model request:

```bash
sudo arena-codex pack --job /operator/jobs/my-first-character
```

Only a finished, validated `bundle/` should be transferred for import. This tool never writes to the live game database or publishes a character. The existing importer requires `prod-tst`; review and staging remain separate from public roster changes. Do not relabel the production database as staging to bypass that check.

## Removal

To remove the command and image without deleting login or job files:

```bash
sudo rm /usr/local/bin/arena-codex
sudo docker image rm arena-criolla:codex-operator-v6
```

The private directory and system user remain available for inspection or deliberate removal.
