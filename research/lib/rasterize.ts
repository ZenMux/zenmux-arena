import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";

// Keep native rasterization for Next/Morphe. The Workers Vite target replaces
// this module, not resvg itself, so PNG export can never resolve to an empty stub.
export async function rasterizeSvg(svg: string, width: number, background: string): Promise<Uint8Array> {
  const fontPath = `${process.cwd()}/research/assets/NotoSansSC-Regular.otf`;
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontFiles: fs.existsSync(fontPath) ? [fontPath] : [], loadSystemFonts: true, defaultFontFamily: "Noto Sans SC" },
    background,
  });
  return new Uint8Array(resvg.render().asPng());
}
