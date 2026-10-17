import { Codex, type ThreadEvent, type UserInput } from "@openai/codex-sdk";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { lstat, readdir, realpath } from "node:fs/promises";

const execute = promisify(execFile);
export const codexCharacterModel = "gpt-6-luna";
export const codexCharacterReasoningEffort = "high";
export function codexEnvironment(source = process.env): Record<string, string> {
  const result: Record<string, string> = {};
  // Keep auth local; never forward application keys, tokens or deployment secrets.
  for (const name of [
    "HOME",
    "PATH",
    "USER",
    "LOGNAME",
    "LANG",
    "LC_ALL",
    "TMPDIR",
    "CODEX_HOME",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "CODEX_CA_CERTIFICATE",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "NO_PROXY",
    "SystemRoot",
  ])
    if (source[name]) result[name] = source[name]!;
  return result;
}
export const codexExecutable = () => process.env.ARENA_CODEX_PATH || "codex";
export const generatedImagesDirectory = () =>
  path.join(
    process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
    "generated_images",
  );

export function assertCodexBillingPolicy(
  policy = process.env.ARENA_CODEX_BILLING_POLICY ?? "chatgpt-plan-and-credits",
) {
  if (policy === "chatgpt-plan-and-credits") return;
  if (policy === "credits-only")
    throw new Error(
      "Generation disabled: Codex uses included subscription allowance before ChatGPT credits. Credits-only billing cannot be enforced. No model request was sent.",
    );
  throw new Error(
    "ARENA_CODEX_BILLING_POLICY must be credits-only or chatgpt-plan-and-credits.",
  );
}

export async function checkCodexLogin() {
  let status: string;
  try {
    const result = await execute(codexExecutable(), ["login", "status"], {
      env: codexEnvironment(),
      timeout: 15_000,
      maxBuffer: 32_768,
    });
    status = result.stdout + result.stderr;
  } catch {
    throw new Error(
      "ChatGPT login unavailable. Run npm run creator:codex -- login in this workspace's terminal.",
    );
  }
  if (!/Logged in using ChatGPT/i.test(status))
    throw new Error(
      "This tool requires ChatGPT sign-in. API-key authentication is not used.",
    );
  return { authentication: "chatgpt" as const };
}

export interface NativeRequest {
  prompt: string;
  imageGeneration?: boolean;
  photos: string[];
  directory: string;
  outputSchema: unknown;
  signal: AbortSignal;
}
export type NativeRunner = (request: NativeRequest) => Promise<unknown>;

export async function disabledMcpOverrides(
  directory: string,
  signal: AbortSignal,
  env = codexEnvironment(),
) {
  try {
    const result = await execute(
      codexExecutable(),
      [
        "-c",
        'forced_login_method="chatgpt"',
        "-c",
        "features.hooks=false",
        "-c",
        "features.plugins=false",
        "-c",
        "features.apps=false",
        "-c",
        "features.shell_tool=false",
        "mcp",
        "list",
        "--json",
      ],
      { cwd: directory, env, signal, timeout: 15_000, maxBuffer: 65_536 },
    );
    const servers: unknown = JSON.parse(result.stdout);
    if (!Array.isArray(servers)) throw new Error();
    const disabled = servers.map((server: unknown) => {
      if (
        !server ||
        typeof server !== "object" ||
        !("name" in server) ||
        typeof server.name !== "string" ||
        !server.name.length ||
        server.name.length > 256
      )
        throw new Error();
      return `${JSON.stringify(server.name)}={enabled=false}`;
    });
    // CLI dotted-key overrides split on every dot, including quoted names.
    // A TOML inline table preserves each exact key during configuration merge.
    // No subprocess output or configured environment values are logged.
    return disabled.length ? [`mcp_servers={${disabled.join(",")}}`] : [];
  } catch {
    signal.throwIfAborted();
    throw new Error(
      "Could not safely disable configured Codex MCP servers. No model request was sent for this turn.",
    );
  }
}

export async function completedOutput(events: AsyncIterable<ThreadEvent>) {
  let completed = false;
  let response = "";
  for await (const event of events) {
    if (event.type === "error" || event.type === "turn.failed") {
      const detail = (
        event.type === "error" ? event.message : event.error.message
      )
        .replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
        .replace(/Bearer\s+[^\s,]+/gi, "Bearer [redacted]")
        .replace(/eyJ[a-zA-Z0-9_.-]+/g, "[redacted]")
        .slice(0, 500);
      throw new Error(
        `Codex turn failed: ${detail}. No automatic generation retry was made.`,
      );
    }
    if (event.type === "item.completed" && event.item.type === "agent_message")
      response = event.item.text;
    if (event.type === "turn.completed") completed = true;
  }
  if (!completed || !response)
    throw new Error("Codex did not complete the turn. No asset was accepted.");
  return JSON.parse(response) as unknown;
}

async function imageReceipt(threadId: string | null, startedAt: number) {
  if (!threadId || !/^[a-f0-9-]{36}$/i.test(threadId)) return;
  const root = generatedImagesDirectory();
  const directory = path.join(root, threadId);
  try {
    // Codex 0.162.1 saves native images by thread even when the assistant's
    // final JSON omits their path. Never search other sessions or reuse art.
    const resolvedRoot = await realpath(root);
    if ((await realpath(directory)) !== path.join(resolvedRoot, threadId))
      return;
    const files = (await readdir(directory)).filter((name) =>
      /^exec-[a-zA-Z0-9-]+\.png$/.test(name),
    );
    if (files.length !== 1) return;
    const file = path.join(directory, files[0]);
    const info = await lstat(file);
    if (
      !info.isFile() ||
      info.size > 32 * 1024 * 1024 ||
      info.mtimeMs < startedAt - 2000
    )
      return;
    return file;
  } catch {
    return;
  }
}

export function nativeRunner(billingPolicy?: string): NativeRunner {
  assertCodexBillingPolicy(billingPolicy);
  return async (request) => {
    request.signal.throwIfAborted();
    const env = codexEnvironment();
    const configOverrides = await disabledMcpOverrides(
      request.directory,
      request.signal,
      env,
    );
    const codex = new Codex({
      codexPathOverride: codexExecutable(),
      env,
      configOverrides,
      config: {
        forced_login_method: "chatgpt",
        model: codexCharacterModel,
        model_reasoning_effort: codexCharacterReasoningEffort,
        model_provider: "openai",
        project_doc_max_bytes: 0,
        features: {
          image_generation: request.imageGeneration ?? true,
          apps: false,
          multi_agent: false,
          // Read-only permits credential reads. Remove command/tool integrations
          // entirely; reference photos are attached directly by the SDK.
          shell_tool: false,
          shell_snapshot: false,
          hooks: false,
          plugins: false,
          unbounded_connection_retries: false,
        },
      },
    });
    const startedAt = Date.now();
    const thread = codex.startThread({
      model: codexCharacterModel,
      modelReasoningEffort: codexCharacterReasoningEffort,
      workingDirectory: request.directory,
      skipGitRepoCheck: true,
      sandboxMode: "read-only",
      approvalPolicy: "never",
      networkAccessEnabled: false,
      webSearchMode: "disabled",
    });
    const input: UserInput[] = [
      { type: "text", text: request.prompt },
      ...request.photos.map((file) => ({
        type: "local_image" as const,
        path: file,
      })),
    ];
    const { events } = await thread.runStreamed(input, {
      outputSchema: request.outputSchema,
      signal: request.signal,
    });
    const result = await completedOutput(events);
    request.signal.throwIfAborted();
    if (
      result &&
      typeof result === "object" &&
      "generatedImagePath" in result
    ) {
      const generatedImagePath = await imageReceipt(thread.id, startedAt);
      request.signal.throwIfAborted();
      // The assistant's path is untrusted. Always select the single regular,
      // fresh receipt belonging to this completed thread, even when a path was
      // supplied explicitly in its JSON response.
      return { generatedImagePath: generatedImagePath ?? null };
    }
    return result;
  };
}
