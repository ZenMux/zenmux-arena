import { NextResponse } from "next/server";

// These build assets are read exclusively through the Workers ASSETS binding.
// run_worker_first keeps direct HTTP requests on this path behind this guard.
export function proxy() {
  return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}
export const config = { matcher: ["/__arena_private/:path*"] };
