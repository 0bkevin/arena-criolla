// Decides which CI checks a diff needs. A test runs when it, or any file it
// imports (transitively), changed. Shared tooling changes run everything.
//   node scripts/select-checks.mjs [base-ref [head-ref]]   (no base: everything)
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
const touched = (pattern) =>
  !changed || changed.some((file) => pattern.test(file));

const everything = touched(
  /^(package(-lock)?\.json|tsconfig\.json|tests\/(helpers|fixtures)\/|scripts\/select-checks\.mjs|\.github\/workflows\/)/,
);

const testFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith(".test.ts")) testFiles.push(file);
  }
})("tests");

// Relative module specifiers and repo paths read at runtime, e.g.
// readFile("shared/asset-variants.json") or new URL("./x.worker.ts", import.meta.url).
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
const isFile = (file) => existsSync(file) && statSync(file).isFile();

const dependencies = new Map();
function dependenciesOf(file) {
  if (dependencies.has(file)) return dependencies.get(file);
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

const affects = (dependency, file) =>
  file === dependency || file.startsWith(`${dependency}/`);
const tests = everything
  ? testFiles
  : testFiles.filter((test) =>
      [...dependenciesOf(test)].some((dependency) =>
        changed.some((file) => affects(dependency, file)),
      ),
    );

// Each process-per-file shard pays a fixed setup cost, so split only large runs.
const shards = Math.min(3, Math.ceil(tests.length / 30));
const checks = {
  tests: tests.sort().join(" "),
  "test-shards": JSON.stringify(
    Array.from({ length: shards }, (_, i) => i + 1),
  ),
  typecheck: /\.(ts|tsx|json)$/,
  assets:
    /^(public\/assets\/|shared\/(sprite-geometry|fighters)\.json$|scripts\/validate-character-assets\.mjs$)/,
  audit: /^package-lock\.json$/,
  "deploy-controls": /^deploy\//,
  // Browser layout checks for anything that changes what the lobby or arena shows.
  e2e: /^(src\/|index\.html|vite\.config\.ts|public\/|shared\/|e2e\/|playwright\.config\.ts$)/,
  // Anything the Docker build copies, plus the smoke test it runs.
  image:
    /^(Dockerfile|\.dockerignore|index\.html|vite\.config\.ts|src\/|shared\/|server\/|public\/|scripts\/(security-smoke\.mjs|creator-import\.ts))/,
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
      (_, list) => `tests=${list.split(" ").filter(Boolean).length} file(s)`,
    ),
);
if (checks.tests) console.log(checks.tests.split(" ").join("\n"));
