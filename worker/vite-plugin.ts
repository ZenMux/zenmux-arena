import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

export function arenaWorkerInputs(): Plugin {
  const root = process.cwd();
  const browse = path.join(root, "src/app/who-are-you/browse/data.ts");
  return {
    name: "arena-worker-inputs",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "virtual:arena-files" || source === "virtual:arena-browse") return `\0${source}`;
      if (!importer || importer.includes("/node_modules/")) return;
      if (["@research/lib/rasterize", path.join(root, "research/lib/rasterize"), path.join(root, "research/lib/rasterize.ts")].includes(source)) return path.join(root, "worker/rasterize.ts");
      if ([browse, browse.slice(0, -3)].includes(source) || (source.startsWith(".") && path.resolve(path.dirname(importer), source) === browse.slice(0, -3))) {
        return path.join(root, "worker/browse-data.ts");
      }
      // Restrict the read-only snapshot adapter to application readers. Node
      // CLI/research writers and third-party packages keep their own fs APIs.
      if (!importer.startsWith(path.join(root, "src/")) && !importer.startsWith(path.join(root, "research/"))) return;
      if (source === "node:fs") return path.join(root, "worker/fs.ts");
      if (source === "node:fs/promises") return path.join(root, "worker/fs-promises.ts");
    },
    transform(code, id) {
      const clean = id.split("?")[0];
      if (!clean.startsWith(path.join(root, "src/")) && !clean.startsWith(path.join(root, "research/"))) return;
      // Cloudflare marks node:* imports external before resolveId hooks run.
      // Rewrite just application fs import specifiers before that decision.
      const transformed = code.replace(/from\s*(["'])node:fs(\/promises)?\1/g,
        (_, _quote, promises) => `from ${JSON.stringify(path.join(root, promises ? "worker/fs-promises.ts" : "worker/fs.ts"))}`);
      if (transformed !== code) return { code: transformed, map: null };
    },
    load(id) {
      const clean = id.split("?")[0];
      if (clean === path.join(root, "research/lib/rasterize.ts")) return `export { rasterizeSvg } from ${JSON.stringify(path.join(root, "worker/rasterize.ts"))};`;
      if (clean === path.join(root, "src/lib/compressed-json.ts")) return `export { compressedJson } from ${JSON.stringify(path.join(root, "worker/compressed-json.ts"))};`;
      if (clean === browse) return `export * from ${JSON.stringify(path.join(root, "worker/browse-data.ts"))};`;
      if (id === "\0virtual:arena-files" || id === "\0virtual:arena-browse") {
        if (this.environment.name === "client") throw new Error("Packaged server inputs must never enter a client bundle.");
        const file = id.endsWith("files") ? "arena-files.json" : "arena-browse.json";
        const source = path.join(root, ".vinext", file);
        if (!fs.existsSync(source)) throw new Error("Worker content missing; run pnpm cf:prepare first.");
        this.addWatchFile(source);
        return `export default ${fs.readFileSync(source, "utf8")};`;
      }
    },
  };
}
