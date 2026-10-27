import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".next/standalone");
let checked = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    const relative = path.relative(root, file);
    if (relative.startsWith(`internal${path.sep}`) || /(^|[/\\])mysql2(?:@[^/\\]+)?([/\\]|$)/.test(relative)) throw new Error(`Internal source code or driver in public artifact: ${relative}`);
    if (entry.isDirectory()) await walk(file);
    else if (entry.isFile() && /\.(m?js|json)$/.test(entry.name) && !relative.includes("node_modules") && entry.name !== "package.json") {
      const text = await readFile(file, "utf8");
      if (/BILLING_DB_HOST|TOKEN_ECON_LIVE_DB_HOST|arena_cache_publish|arena_cache_acquire/.test(text)) throw new Error(`Source access or writer capability in public artifact: ${relative}`);
      checked++;
    }
  }
}
await walk(root);
console.log(`OK public artifact: ${checked} files inspected; no internal query code, MySQL driver or snapshot writer capabilities.`);
