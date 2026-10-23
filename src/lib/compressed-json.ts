import { gzipSync } from "node:zlib";

// Next/Node sends the supplied bytes unchanged; retain its explicit compression.
export function compressedJson(json: string): { body: BodyInit; headers: Record<string, string> } {
  const bytes = gzipSync(json);
  return { body: bytes, headers: { "Content-Encoding": "gzip", "Content-Length": String(bytes.length) } };
}
