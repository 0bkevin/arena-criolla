import { parseArgs } from "node:util";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  assertCodexBillingPolicy,
  codexCharacterModel,
  codexCharacterReasoningEffort,
  checkCodexLogin,
  codexEnvironment,
  codexExecutable,
  generatedImagesDirectory,
  nativeRunner,
} from "./creator-codex/native";
import { generateCodexCharacter, packCodexJob } from "./creator-codex/workflow";

process.umask(0o077);
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
process.once("SIGTERM", () => controller.abort());
try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      input: { type: "string" },
      photo: { type: "string", multiple: true },
      job: { type: "string" },
      "creator-name": { type: "string", default: "QA privado" },
    },
  });
  const [command] = positionals;
  if (command === "login") {
    const child = spawn(codexExecutable(), ["login", "--device-auth"], {
      env: codexEnvironment(),
      stdio: "inherit",
      signal: controller.signal,
    });
    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error("ChatGPT login did not finish.")),
      );
    });
    await checkCodexLogin();
    console.log("ChatGPT login ready.");
  } else if (command === "doctor") {
    console.log(
      JSON.stringify({
        ...(await checkCodexLogin()),
        model: codexCharacterModel,
        reasoningEffort: codexCharacterReasoningEffort,
        executable: codexExecutable(),
      }),
    );
  } else if (
    command === "generate" &&
    values.input &&
    values.job &&
    values.photo
  ) {
    assertCodexBillingPolicy();
    await checkCodexLogin();
    const result = await generateCodexCharacter({
      input: JSON.parse(await readFile(values.input, "utf8")),
      photos: values.photo,
      job: values.job,
      creatorName: values["creator-name"]!,
      generatedImagesDir: generatedImagesDirectory(),
      run: nativeRunner(),
      signal: controller.signal,
      progress: (phase) => console.log(phase),
    });
    console.log(
      JSON.stringify({
        id: result.id,
        status: "ready",
        bundle: result.bundleDir,
      }),
    );
  } else if (command === "pack" && values.job) {
    const result = await packCodexJob(values.job, controller.signal);
    console.log(
      JSON.stringify({
        id: result.id,
        status: "ready",
        bundle: result.bundleDir,
      }),
    );
  } else
    throw new Error(
      "Usage: npm run creator:codex -- doctor | login | generate --input character.json --photo photo.jpg [--photo extra.jpg] --job data/creator-codex/new-job | pack --job data/creator-codex/existing-job",
    );
} catch (error) {
  // SDK errors may contain request details. Only our concise status is logged here.
  console.error(
    error instanceof Error ? error.message : "Codex workflow failed.",
  );
  process.exitCode = 1;
}
