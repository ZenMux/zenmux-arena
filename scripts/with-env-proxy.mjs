// Load local configuration and enable proxy support before Node tooling boots.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parse } from "dotenv";

const require = createRequire(import.meta.url);
const [tool, ...args] = process.argv.slice(2);
if (!["next", "tsx"].includes(tool)) throw new Error("Expected next or tsx.");

let localEnv = {};
try { localEnv = parse(readFileSync(".env.local")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
// Host/platform variables take precedence; local configuration is optional.
const env = { ...localEnv, ...process.env, NODE_USE_ENV_PROXY: "1" };

const manifest = require.resolve(`${tool}/package.json`);
const pkg = JSON.parse(readFileSync(manifest, "utf8"));
const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin[tool];
const child = spawn(process.execPath, [path.resolve(path.dirname(manifest), bin), ...args], { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => child.kill(signal));
child.on("error", () => { console.error(`Could not start ${tool}.`); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
