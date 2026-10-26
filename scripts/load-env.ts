import { parse } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";

/** Local entrypoints only: never import this helper from application/runtime code. */
export function loadLocalEnv(
  directory = path.resolve(import.meta.dirname, ".."),
  environment: Record<string, string | undefined> = process.env,
): { loaded: boolean; keys: string[] } {
  let source: string;
  try {
    source = readFileSync(path.join(directory, ".env.local"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // CI/deployed processes have no local credential file; keep injected env.
      return { loaded: false, keys: [] };
    }
    throw error;
  }
  // Same precedence as dotenv's default override:false. parse() is silent and
  // no credential values escape through return values or diagnostic output.
  const variables = parse(source);
  for (const [name, value] of Object.entries(variables)) {
    if (!Object.hasOwn(environment, name)) environment[name] = value;
  }
  return { loaded: true, keys: Object.keys(variables) };
}
