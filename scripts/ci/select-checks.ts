// Decides which CI checks a diff needs. A test runs when it, or any file it
// imports (transitively), changed. Shared tooling changes run everything.
//   node scripts/ci/select-checks.ts [base-ref [head-ref]]   (no base: everything)
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";

const [base, head = "HEAD"] = process.argv.slice(2);
const changed = base
  ? execFileSync(
      "git",
      ["diff", "--name-only", "--no-renames", `${base}...${head}`],
      { encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean)
  : null;
const touched = (pattern: RegExp): boolean =>
  !changed || changed.some((file) => pattern.test(file));

const everything = touched(
  /^(package(-lock)?\.json|tsconfig\.json|tests\/helpers\/|scripts\/ci\/select-checks\.ts|\.github\/workflows\/)/,
);

const testFiles: string[] = [];
(function walk(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith(".test.ts")) testFiles.push(file);
  }
})("tests");

// Relative module specifiers and repo paths read at runtime, e.g.
// readFile("server/asset-variants.json") or new URL("./x.worker.ts", import.meta.url).
const SPECIFIER =
  /(?:from\s+|import\s*\(\s*|import\s+|new URL\(\s*)["'](\.{1,2}\/[^"']+)["']/g;
const REPO_PATH =
  /["'`]((?:src|shared|server|public|scripts|deploy)\/[\w./-]+)["'`]/g;
const EXTENSIONS = [
  "",
  ".ts",
  ".tsx",
  ".mjs",
  ".js",
  ".json",
  "/index.ts",
  "/index.tsx",
];
const isFile = (file: string): boolean =>
  existsSync(file) && statSync(file).isFile();

const dependencies = new Map<string, Set<string>>();
function dependenciesOf(file: string): Set<string> {
  if (dependencies.has(file)) return dependencies.get(file)!;
  const found = new Set([file]);
  dependencies.set(file, found);
  if (!/\.(ts|tsx|mjs|js)$/.test(file)) return found;
  const source = readFileSync(file, "utf8");
  for (const [, specifier] of source.matchAll(SPECIFIER)) {
    const target = path.posix.join(
      path.posix.dirname(file),
      specifier.split("?")[0],
    );
    const resolved = EXTENSIONS.map((extension) => target + extension).find(
      isFile,
    );
    if (resolved)
      for (const dependency of dependenciesOf(resolved)) found.add(dependency);
  }
  for (const [, repoPath] of source.matchAll(REPO_PATH))
    if (existsSync(repoPath)) found.add(repoPath.replace(/\/$/, ""));
  return found;
}

const affects = (dependency: string, file: string): boolean =>
  file === dependency || file.startsWith(`${dependency}/`);
const tests = everything
  ? testFiles
  : testFiles.filter((test) =>
      [...dependenciesOf(test)].some((dependency) =>
        // Not everything, so there is a base and a list of changed files.
        changed!.some((file) => affects(dependency, file)),
      ),
    );

// Each process-per-file shard pays a fixed setup cost, so split only large runs.
const shards = Math.min(3, Math.ceil(tests.length / 30));
const checks: {
  tests: string;
  "test-shards": string;
  [name: string]: string | RegExp | boolean;
} = {
  tests: tests.sort().join(" "),
  "test-shards": JSON.stringify(
    Array.from({ length: shards }, (_, i) => i + 1),
  ),
  typecheck: /\.(ts|tsx|json)$/,
  format: /\.(ts|tsx|json|jsonc|css|md|ya?ml|html)$/,
  assets:
    /^(public\/assets\/|src\/game\/assets\/manifests\/sprite-geometry\.json$|shared\/roster\/fighters\.json$|scripts\/assets\/validate-character-assets\.ts$)/,
  audit: /^package-lock\.json$/,
  "deploy-controls": /^deploy\//,
  // Browser layout checks for anything that changes what the lobby or arena shows.
  // The layout job serves the client through the Node server, so server/ counts.
  e2e: /^(src\/|index\.html|vite\.config\.ts|public\/|shared\/|server\/|e2e\/|playwright\.config\.ts$)/,
  // The production Worker: its adapter, the shared lobby and the bundled site.
  worker:
    /^(cloudflare\/|shared\/|src\/|public\/|index\.html|vite\.config\.ts|server\/asset-(versions\.ts|variants\.json)|wrangler\.jsonc|scripts\/cloudflare\/)/,
  // Anything the Docker build copies, plus the smoke test it runs.
  image:
    /^(Dockerfile|\.dockerignore|index\.html|vite\.config\.ts|src\/|shared\/|server\/|public\/|scripts\/ci\/security-smoke\.ts)/,
  // New base layers or dependencies can bring new CVEs.
  scan: /^(Dockerfile|package-lock\.json)$/,
};
for (const [name, pattern] of Object.entries(checks))
  if (pattern instanceof RegExp) checks[name] = everything || touched(pattern);

const lines = Object.entries(checks).map(([name, value]) => `${name}=${value}`);
if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
console.log(
  changed
    ? `${changed.length} changed file(s) since ${base}`
    : "No base: running every check",
);
console.log(
  lines
    .join("\n")
    .replace(
      /^tests=(.*)$/m,
      (_: string, list: string) =>
        `tests=${list.split(" ").filter(Boolean).length} file(s)`,
    ),
);
if (checks.tests) console.log(checks.tests.split(" ").join("\n"));
