// Start Node tooling with proxy support enabled before the child runtime boots.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parse } from "dotenv";

const require = createRequire(import.meta.url);
const [tool, ...args] = process.argv.slice(2);
if (!["next", "tsx"].includes(tool)) throw new Error("Expected next or tsx.");

const env = { ...process.env, NODE_USE_ENV_PROXY: "1" };
const proxyKeys = ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy"];
// Local proxy addresses may live in .env.local; no credentials are loaded here.
for (const file of [".env.local", ".env"]) {
  let values;
  try { values = parse(readFileSync(file)); }
  catch (error) { if (error.code === "ENOENT") continue; throw error; }
  for (const key of proxyKeys) if (env[key] === undefined && values[key] !== undefined) env[key] = values[key];
}

const manifest = require.resolve(`${tool}/package.json`);
const pkg = JSON.parse(readFileSync(manifest, "utf8"));
const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin[tool];
const child = spawn(process.execPath, [path.resolve(path.dirname(manifest), bin), ...args], { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => child.kill(signal));
child.on("error", () => { console.error(`Could not start ${tool}.`); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
