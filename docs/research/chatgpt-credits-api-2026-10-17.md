# ChatGPT credits and Arena Criolla API access

Verified against current official OpenAI documentation on 2026-10-17. The initial SIWC investigation was documentation-only. The follow-up below records one authorized native Codex SDK image-generation test using an existing ChatGPT login. No credential contents were read, no Platform API-key billed requests were made, and no app/service settings were changed. Built-in generation consumes Codex plan usage; the exact credit deduction was not measured.

## Finding

**ChatGPT Pro/Work/Codex usage can fund some public OpenAI API requests through Sign in with ChatGPT (SIWC).** The documented open-source integration obtains an OAuth grant for eligible Responses requests; it does not require a Platform API key. Eligible Plus and Pro subscribers can authorize this usage. Consequently, saying ChatGPT credits can never be used through a public API is too categorical. [SIWC quickstart](https://developers.openai.com/siwc/quickstart)

**This does not make Arena Criolla's existing service-account key draw from its owner's ChatGPT balance.** OpenAI documents API-key billing separately from ChatGPT-plan authentication. The reported `429 credit_balance_exhausted` means the API organization's prepaid balance has run out; it does not establish that the approximately 57,000 credits shown in ChatGPT are exhausted. [Authentication](https://learn.chatgpt.com/docs/auth), [API error codes](https://developers.openai.com/api/docs/guides/error-codes)

## What the public SIWC route supports

| Area               | Current documented behavior                                                                                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inference endpoint | `POST https://api.openai.com/v1/responses`, with the authorized OAuth access token as the bearer credential. The guide explicitly rejects using ChatGPT `backend-api` endpoints for this integration.                                           |
| Request contract   | Set `store: false` and `stream: true`; consume through `response.completed`. A stream beginning is insufficient proof of successful inference.                                                                                                  |
| Model availability | Query `GET https://api.openai.com/v1/models` with the same OAuth token and use an available model's `slug`. Availability follows the signed-in account. This investigation did not determine whether this user's account offers `gpt-4.1-mini`. |

Source: [Models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference).

The open-source authorization uses identity scopes `openid profile email` plus `offline_access resource.invoke chatgpt.tokens.use.direct`, with resource `https://api.openai.com/v1`. Initial registration uses `dynamic_agent_client`, then saves the issued client ID. It requires a stable host ID, PKCE, and a `127.0.0.1` loopback callback. The app must validate the ID token and confirm the _granted_ `chatgpt.tokens.use.direct` scope before inference. Identity sign-in alone does not authorize spending plan usage. [Registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)

SIWC usage consumes the existing Codex/ChatGPT Work allowance. In **ChatGPT → Settings → Usage**, users can cap an app's weekly plan usage and enable **“Allow other apps to use credits after reaching your usage limit.”** This setting applies to apps already authorized for plan usage; it does not convert an API key into a SIWC credential. The user's actual setting and eligibility remain unverified. [User guide](https://learn.chatgpt.com/docs/sign-in-with-chatgpt)

## Images: current blocker for the drawing feature

The preview limitations expressly list **“Unsupported tools: Image generation”** for ChatGPT plan usage through `https://api.openai.com/v1`, both directly and through Codex app-server. Image _input_ is supported when the selected model accepts it; that permits visual analysis, not image output. The preview also requires an `input` array and excludes fields including `temperature`, `max_output_tokens`, and HTTP `previous_response_id`, so adopting this route requires adapting the request shape. [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)

Arena Criolla's `gpt-image-2` drawing call uses `POST /v1/images/edits`. The standard Images API documents that model and endpoint, using `OPENAI_API_KEY` in its examples. **The public SIWC preview does not document authorization for this endpoint, and explicitly excludes image generation via Responses.** Switching the drawing request to a Responses `image_generation` tool therefore does not solve the credit issue under the current preview. [Create image edit](https://developers.openai.com/api/reference/resources/images/methods/edit), [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)

Native Codex/ChatGPT image generation is a separate supported product capability: the user guide says built-in generation uses `gpt-image-2` and consumes Codex usage. For programmatic image generation it directs developers to the Image API, and explains that API-key image requests use API pricing. Native availability does not establish that an external application receives the same API permissions. [Image generation in ChatGPT/Codex](https://learn.chatgpt.com/docs/image-generation?surface=app)

## Oracle VM versus a publicly hosted app

The overview covers open-source and locally hosted apps and directs developers offering plan usage in a paid or remotely hosted app to an interest form. A client's grant is bound to the authorizing user/workspace. A laptop and self-hosted VM belonging to that same user/workspace may share the client registration, with separate host IDs. [SIWC overview](https://developers.openai.com/siwc/token-sharing-open-source)

The dedicated VM guide explicitly supports running an open-source app on a remote VM: complete OAuth locally, securely transfer that registration's protected credentials, preserve the VM's distinct host ID, and let the VM manage subsequent refreshes. Thus Oracle hosting alone is not disqualifying for personal self-hosting. [Self-hosted VMs](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms)

**Interpretation for Arena Criolla:** its GPL license is relevant to the open-source path, but does not by itself establish permission to offer SIWC usage through a public multiuser backend or let visitors consume one owner's ChatGPT credits. The documented same-user VM procedure is narrower than that offering. A hosted public integration needs OpenAI's applicable onboarding/approval clarified; the docs do not establish this app's eligibility. [SIWC overview](https://developers.openai.com/siwc/token-sharing-open-source), [Quickstart](https://developers.openai.com/siwc/quickstart)

## Practical conclusions and remaining unknowns

- A personal, self-hosted text integration has a documented SIWC path, subject to the user's granted scopes, available models, limits, and current preview restrictions.
- The existing public drawing backend has no documented ChatGPT-credit funding path through `/v1/images/edits`. Its standard API-key route needs usable Platform billing unless OpenAI grants a different supported integration.
- No account-specific SIWC eligibility, exact credit-balance eligibility, SIWC model catalog, or hosted-partner approval was verified.
- SIWC failures do not silently switch billing paths. `subscription_sharing_usage_limit_exceeded` can represent an app-specific cap, while `subscription_sharing_unsupported_capability` and `subscription_sharing_route_not_supported` identify capability/route restrictions. Support in another client or route does not authorize its use here. [Errors and recovery](https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery)

## Follow-up: native Codex, SDK, and app-server

**Signing into native Codex with ChatGPT does allow image creation.** The CLI instructions describe requesting an image in an interactive session or invoking `$imagegen`, with `-i`/`--image` for a reference. A supported asset workflow is to generate/edit the PNG in a personal Codex session, save the result, and import that asset into Arena Criolla. [Native image generation](https://learn.chatgpt.com/docs/image-generation?surface=cli)

The **Codex SDK** is distinct from the regular OpenAI API SDK. OpenAI documents the TypeScript library for server-side Node.js applications and automated local Codex threads. `codex exec` reuses saved CLI authentication by default, and the automation guide separately describes advanced ChatGPT-managed authentication. These establish a native automation route; they do not, by themselves, promise that a particular SDK/runtime exposes the built-in image tool. [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk), [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)

The **native app-server** supports Codex-managed ChatGPT authentication and skill inputs through `turn/start`; `skills/list` discovers installed skills. A skill marker is not proof that its required image tool is available. Crucially, its authentication documentation says **“App-server authentication has never been permitted for commercial or hosted services.”** It permits continuing existing local/open-source integrations while recommending migration to SIWC. Therefore a native integration's technical capability does not authorize exposing one account's session through a public backend. [Native app-server](https://learn.chatgpt.com/docs/app-server#auth-endpoints)

The restricted **SIWC app-server example** explicitly configures a custom provider at `https://api.openai.com/v1` with a separate direct-plan OAuth token. That is the specific app-server configuration covered by the earlier preview restrictions. It should not be generalized into a claim that native Codex cannot generate images. [SIWC app-server configuration](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server)

The transparent-assets cookbook does not establish SDK image access: it requires `OPENAI_API_KEY`, generates PNGs through `client.images.generate`, then asks Codex to build a website or slide from those files. It is useful for asset preparation and validation, but uses standard API billing for generation. [Transparent-assets cookbook](https://developers.openai.com/cookbook/examples/multimodal/transparent-image-assets-for-campaigns-and-presentations)

### Observed SDK image-generation success

**The native TypeScript SDK path worked in an isolated local test.** The test used `@openai/codex-sdk@0.162.1` with the installed `codex-cli 0.162.1` and the existing ChatGPT sign-in. The installed SDK implementation invokes `codex exec --experimental-json`; it is a wrapper around the native agent rather than `client.images.edit`. [Installed SDK implementation](/workspace/arena-deploy/prod-tst/sdk-probe/node_modules/@openai/codex-sdk/dist/index.js:178)

The test removed `OPENAI_API_KEY`, `CODEX_API_KEY`, and `OPENAI_BASE_URL` from the child environment, supplied no SDK API key or base URL, and enabled `features.image_generation`. It called `thread.runStreamed` with `$imagegen`, required the built-in `image_gen` tool, prohibited API-key/image-API and code-drawn alternatives, and set a 180-second timeout. It completed in about 39 seconds and copied the original generated image to `sdk-proof.png`. [Probe script](/workspace/arena-deploy/prod-tst/sdk-probe/probe.mjs), [Recorded events](/workspace/arena-deploy/prod-tst/sdk-probe/output/probe-events.json)

The result is a 477,952-byte PNG, 1295 × 1214 pixels, depicting a red five-point star. Its alpha channel contains both transparent and opaque pixels. The recorded SDK summary contains the agent's image-generation report, successful copy from Codex's `generated_images` directory, and `turn.completed`; it does not expose a dedicated image-result object. This demonstrates a working file-based output workflow on the tested runtime/account, rather than a generic Images API response contract. [Generated PNG](/workspace/arena-deploy/prod-tst/sdk-probe/output/sdk-proof.png)

**Actionable path:** build a personal local asset-generation tool around this native SDK setup, save each generated PNG to a dedicated output directory, verify successful completion and the output file, then import the image into the game. This is a demonstrated way to create game assets using ChatGPT-authenticated Codex. The test does not establish access for every account/version, exact credit cost, or permission to expose that native session as Arena Criolla's public Oracle image-generation backend. The hosted-service restriction above remains a separate issue.
