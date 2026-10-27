import { build } from "esbuild";
import { mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const output = path.resolve("dist/data-refresh");
// Internal jobs follow the local exact pin, independently of Vercel's engines.
const nodeVersion = (await readFile(".node-version", "utf8")).trim();
assert.equal((await readFile(".nvmrc", "utf8")).trim(), nodeVersion, "Local Node version pins must agree.");
await mkdir(path.join(output, "config"), { recursive: true });
await build({
  entryPoints: ["internal/data-refresh/main.ts"], outfile: path.join(output, "refresh.mjs"),
  bundle: true, platform: "node", target: `node${nodeVersion}`, format: "esm", external: ["mysql2/promise"],
  banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
});
for (const name of ["token-deals.json", "token-economics-live-models.json"]) await copyFile(path.join("config", name), path.join(output, "config", name));
for (const name of [".env.example", "refresh.cron", "README.md"]) await copyFile(path.join("internal/data-refresh", name), path.join(output, name));
for (const name of [".nvmrc", ".node-version"]) await copyFile(name, path.join(output, name));
const mysqlVersion = JSON.parse(await readFile("node_modules/mysql2/package.json", "utf8")).version;
await writeFile(path.join(output, "package.json"), JSON.stringify({ name: "arena-data-refresh", private: true, type: "module", engines: { node: nodeVersion }, dependencies: { mysql2: mysqlVersion } }, null, 2) + "\n");
console.log(`Built standalone refresh runner in ${output}; install its dependencies with npm install --omit=dev.`);
