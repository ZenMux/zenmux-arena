declare module "virtual:arena-files" {
  const files: import("./content-types").FileManifest;
  export default files;
}
declare module "virtual:arena-browse" {
  const runs: Record<string, {
    ref: import("../src/app/who-are-you/browse/data").RunRef;
    models: Array<import("../src/app/who-are-you/browse/data").ModelEntry & { asset: string }>;
    totalAnswers: number;
  }>;
  export default runs;
}
declare module "cloudflare:workers" {
  export const env: { ASSETS: { fetch(request: Request): Promise<Response> } };
}
declare module "*.wasm" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
