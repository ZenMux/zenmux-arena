import path from "node:path";
import { Buffer } from "node:buffer";
import type { FileManifest } from "./content-types";

// Workers has no checkout. Only explicitly packaged, immutable application
// inputs are readable; never turn a missing file or a write into silent success.
export function createReadonlyFs(files: FileManifest, cwd = "/") {
  const directories = new Set<string>([""]);
  for (const key of Object.keys(files)) {
    let parent = path.posix.dirname(key);
    while (parent !== ".") {
      directories.add(parent);
      parent = path.posix.dirname(parent);
    }
  }
  function keyOf(input: string | URL): string {
    const value = input instanceof URL ? decodeURIComponent(input.pathname) : String(input);
    const root = path.posix.resolve(cwd);
    const absolute = path.posix.resolve(root, value);
    const relative = path.posix.relative(root, absolute);
    if (relative === ".." || relative.startsWith("../")) throw error("ENOENT", value);
    return relative;
  }
  function error(code: string, file: string): NodeJS.ErrnoException {
    return Object.assign(new Error(`${code}: packaged read-only input '${file}'`), { code });
  }
  function readFileSync(input: string | URL, encoding: BufferEncoding): string;
  function readFileSync(input: string | URL): Buffer;
  function readFileSync(input: string | URL, encoding?: BufferEncoding): string | Buffer {
    const key = keyOf(input);
    const file = files[key];
    if (!file) throw error(directories.has(key) ? "EISDIR" : "ENOENT", key);
    const bytes = Buffer.from(file.base64, "base64");
    return encoding ? bytes.toString(encoding) : bytes;
  }
  function statSync(input: string | URL) {
    const key = keyOf(input);
    if (!files[key] && !directories.has(key)) throw error("ENOENT", key);
    return { size: files[key]?.size ?? 0, mtimeMs: 0, isDirectory: () => directories.has(key), isFile: () => !!files[key] };
  }
  function existsSync(input: string | URL): boolean {
    try { const key = keyOf(input); return !!files[key] || directories.has(key); } catch { return false; }
  }
  function readdirSync(input: string | URL): string[] {
    const key = keyOf(input);
    if (!directories.has(key)) throw error(files[key] ? "ENOTDIR" : "ENOENT", key);
    const prefix = key ? `${key}/` : "";
    return [...new Set([...directories, ...Object.keys(files)]
      .filter((candidate) => candidate.startsWith(prefix) && candidate !== key)
      .map((candidate) => candidate.slice(prefix.length).split("/")[0]))].sort();
  }
  async function readFile(input: string | URL, encoding: BufferEncoding): Promise<string>;
  async function readFile(input: string | URL): Promise<Buffer>;
  async function readFile(input: string | URL, encoding?: BufferEncoding) {
    return encoding ? readFileSync(input, encoding) : readFileSync(input);
  }
  const rejectWrite = async () => { throw error("EROFS", "Workers content"); };
  const promises = { readFile, mkdir: rejectWrite, writeFile: rejectWrite, rename: rejectWrite, unlink: rejectWrite };
  return { existsSync, statSync, readdirSync, readFileSync, promises };
}
