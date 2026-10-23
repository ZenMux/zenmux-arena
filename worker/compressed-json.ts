// Workers compresses according to Content-Encoding at the HTTP boundary.
// Vinext can reconstruct Responses (losing encodeBody: "manual"), so provide
// plain JSON and let the runtime compress once instead of pre-gzipping it.
export function compressedJson(json: string): { body: BodyInit; headers: Record<string, string> } {
  return { body: json, headers: { "Content-Encoding": "gzip" } };
}
