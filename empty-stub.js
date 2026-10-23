// Vite alias target for native addons that cannot load in workerd.
// CLI scripts (tsx) do not use this alias and still import the real package.
export class Resvg {
  constructor() {
    throw new Error(
      "@resvg/resvg-js is not available in the Cloudflare Worker bundle.",
    );
  }
}

const stub = { Resvg };
export default stub;
