import { gzipSync } from "node:zlib";
import {
  DealsDbConfigError,
  buildDegradedPayload,
  getTokenDealsWithMeta,
} from "@research/token-deals/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Same explicit-gzip rationale as /api/token-economics/live: Next's `compress`
// is bypassed under standalone + an external gateway, and repetitive JSON gzips
// ~10x for tens of ms of CPU.
// CDN caching: the data only advances every 5 minutes (refresh boundary), so a
// short shared-cache TTL is lossless for freshness but lets the edge absorb
// repeat traffic (and keeps the origin function warm-ish). Browsers still
// always revalidate (max-age=0) — the client polls on its own schedule.
//   healthy  → 60s at the edge + 4min serve-stale-while-revalidating
//   stale    → 15s (the origin is mid-refresh; let the edge retry soon)
//   degraded → never cached (an outage must not be pinned at the edge)
export type CachePolicy = "healthy" | "stale" | "degraded";

const CACHE_CONTROL: Record<CachePolicy, string> = {
  healthy: "public, max-age=0, s-maxage=60, stale-while-revalidate=240",
  stale: "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
  degraded: "no-store, max-age=0",
};

function jsonResponse(
  data: unknown,
  acceptEncoding: string,
  extraHeaders: Record<string, string>,
  cachePolicy: CachePolicy = "degraded",
  status = 200,
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": CACHE_CONTROL[cachePolicy],
    Vary: "Accept-Encoding",
    ...extraHeaders,
  };
  const json = JSON.stringify(data);
  if (acceptEncoding.includes("gzip")) {
    const gz = gzipSync(json);
    headers["Content-Encoding"] = "gzip";
    headers["Content-Length"] = String(gz.length);
    return new Response(gz, { status, headers });
  }
  return new Response(json, { status, headers });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const acceptEncoding = request.headers.get("accept-encoding") ?? "";
  try {
    const { payload, source, elapsedMs } = await getTokenDealsWithMeta(
      searchParams.get("range"),
      new Date(),
    );
    const cachePolicy: CachePolicy = !payload.live
      ? "degraded"
      : payload.stale
        ? "stale"
        : "healthy";
    return jsonResponse(
      payload,
      acceptEncoding,
      {
        "X-Cache-Source": source,
        "X-Server-Time": `${elapsedMs}ms`,
        "Server-Timing": `deals;desc=${source};dur=${elapsedMs}`,
      },
      cachePolicy,
    );
  } catch (error) {
    // Billing DB missing/unreachable → DEGRADED, not an error: deal facts fall
    // back to the packaged baseline and must stay usable (PRD 图 5). The
    // client keys off `live: false` to show the unavailable state + retry.
    if (error instanceof DealsDbConfigError) {
      console.warn("[token-deals] live DB not configured, serving degraded payload");
    } else {
      console.error("[token-deals] live aggregation failed, serving degraded payload:", error);
    }
    try {
      const degraded = await buildDegradedPayload(new Date());
      return jsonResponse(degraded, acceptEncoding, { "X-Cache-Source": "degraded" });
    } catch (inner) {
      console.error("[token-deals] degraded payload failed too:", inner);
      return Response.json(
        { error: "Failed to load token deals." },
        { status: 500, headers: { "X-Cache-Source": "error" } },
      );
    }
  }
}
