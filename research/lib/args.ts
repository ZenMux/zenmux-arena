// Tiny flag parser shared by the scripts. Supports `--key value` and `--flag` (boolean).

export interface ParsedArgs {
  get(name: string): string | undefined;
  has(name: string): boolean;
  num(name: string, fallback: number): number;
}

export function parseArgs(argv = process.argv.slice(2)): ParsedArgs {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const name = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      values[name] = next;
      i++;
    } else {
      flags.add(name);
    }
  }
  return {
    get: (name) => values[name],
    has: (name) => flags.has(name) || name in values,
    num: (name, fallback) => {
      const v = values[name];
      if (v === undefined) return fallback;
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    },
  };
}
