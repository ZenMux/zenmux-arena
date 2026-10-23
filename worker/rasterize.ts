import { Resvg, initWasm } from "@resvg/resvg-wasm";
import wasm from "@resvg/resvg-wasm/index_bg.wasm";
import { env } from "cloudflare:workers";

let initialized: Promise<void> | undefined;
let fontBytes: Uint8Array | undefined;
export async function rasterizeSvg(svg: string, width: number, background: string): Promise<Uint8Array> {
  initialized ??= initWasm(wasm).catch((error) => { initialized = undefined; throw error; });
  await initialized;
  // Cache bytes, not an in-flight fetch tied to another request's I/O context.
  if (!fontBytes) {
    const response = await env.ASSETS.fetch(new Request("http://localhost/__arena_private/NotoSansSC-Regular.otf"));
    if (!response.ok) throw new Error(`Packaged export font unavailable (${response.status})`);
    fontBytes = new Uint8Array(await response.arrayBuffer());
  }
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontBuffers: [fontBytes], loadSystemFonts: false, defaultFontFamily: "Noto Sans SC" },
    background,
  });
  try {
    const image = resvg.render();
    try { return new Uint8Array(image.asPng()); } finally { image.free(); }
  } finally { resvg.free(); }
}
