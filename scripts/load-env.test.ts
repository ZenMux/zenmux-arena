import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { MANAGEMENT_API_KEY_ENV } from "../research/token-economics/usage";
import { loadLocalEnv } from "./load-env";

function fixture(t: TestContext): string {
  const directory = mkdtempSync(path.join(tmpdir(), "arena-env-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("inherited process env takes precedence over .env.local under the canonical Management API name", (t) => {
  const directory = fixture(t);
  writeFileSync(path.join(directory, ".env.local"), 'ZENMUX_MANAGEMENT_API_KEY="synthetic-local-key"\nTOKEN_ECON_LIVE_DB_PORT=3306\n');
  const environment: Record<string, string | undefined> = {
    ZENMUX_MANAGEMENT_API_KEY: "synthetic-shell-key",
    SUPABASE_URL: "https://synthetic.example",
  };
  const result = loadLocalEnv(directory, environment);
  assert.equal(MANAGEMENT_API_KEY_ENV, "ZENMUX_MANAGEMENT_API_KEY");
  assert.equal(environment[MANAGEMENT_API_KEY_ENV], "synthetic-shell-key");
  assert.equal(environment.TOKEN_ECON_LIVE_DB_PORT, "3306");
  assert.equal(environment.SUPABASE_URL, "https://synthetic.example");
  assert.deepEqual(result, { loaded: true, keys: ["ZENMUX_MANAGEMENT_API_KEY", "TOKEN_ECON_LIVE_DB_PORT"] });
});

test("missing local file preserves CI/runtime-injected environment and ignores other dotenv files", (t) => {
  const directory = fixture(t);
  writeFileSync(path.join(directory, ".env"), "ZENMUX_MANAGEMENT_API_KEY=synthetic-wrong-file\n");
  writeFileSync(path.join(directory, ".env.example"), "ZENMUX_MANAGEMENT_API_KEY=synthetic-example\n");
  const environment = { ZENMUX_MANAGEMENT_API_KEY: "synthetic-runtime-key" };
  assert.deepEqual(loadLocalEnv(directory, environment), { loaded: false, keys: [] });
  assert.deepEqual(environment, { ZENMUX_MANAGEMENT_API_KEY: "synthetic-runtime-key" });
});

test("blank local values do not clear existing process credentials", (t) => {
  const directory = fixture(t);
  writeFileSync(path.join(directory, ".env.local"), "ZENMUX_API_KEY=\n");
  const environment = { ZENMUX_API_KEY: "synthetic-shell-key" };
  loadLocalEnv(directory, environment);
  assert.equal(environment.ZENMUX_API_KEY, "synthetic-shell-key");
});

test("loading is silent and never returns credential values", (t) => {
  const directory = fixture(t);
  const key = "synthetic-private-value";
  writeFileSync(path.join(directory, ".env.local"), `ZENMUX_API_KEY=${key}\n`);
  const output: unknown[] = [];
  t.mock.method(console, "log", (...args: unknown[]) => { output.push(args); });
  t.mock.method(console, "error", (...args: unknown[]) => { output.push(args); });
  const result = loadLocalEnv(directory, {});
  assert.deepEqual(output, []);
  assert.equal(JSON.stringify(result).includes(key), false);
});

test("non-missing file read errors fail instead of silently using shell values", (t) => {
  const directory = fixture(t);
  mkdirSync(path.join(directory, ".env.local"));
  assert.throws(() => loadLocalEnv(directory, {}), { code: "EISDIR" });
});

test("all local data entrypoints share the bootstrap and the template has no embedded keys", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const entrypoints = [
    "next.config.ts", "vite.config.ts", "scripts/supabase-setup.ts",
    ...["run", "extract", "aggregate", "report", "mix", "tokenecon", "refresh-live", "refresh-deals", "backfill-deals", "sync-deals-config"]
      .map((name) => `research/scripts/${name}.ts`),
    ...["run", "aggregate", "check-models"].map((name) => `research/personality/${name}.ts`),
    "src/app/talk/economics/history/export.ts",
  ];
  for (const entrypoint of entrypoints) {
    const source = readFileSync(path.join(root, entrypoint), "utf8");
    assert.match(source, /import "(?:\.\.\/|\.\/)+(?:scripts\/)?local-env";/, entrypoint);
    assert.doesNotMatch(source, /from "dotenv"/, entrypoint);
  }
  const template = readFileSync(path.join(root, ".env.example"), "utf8");
  assert.match(template, /^ZENMUX_MANAGEMENT_API_KEY=$/m);
  for (const name of ["ZENMUX_API_KEY", "TOKEN_ECON_LIVE_DB_PASSWORD", "SUPABASE_SECRET_KEY"]) {
    assert.match(template, new RegExp(`^${name}=$`, "m"));
  }
});
