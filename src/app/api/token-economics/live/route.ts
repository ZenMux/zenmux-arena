import { gzipSync } from "node:zlib";
import {
  getLiveTokenEconomicsWithMeta,
  LiveConfigError,
  LiveDbConfigError,
} from "@research/token-economics/live-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// The live payload is large (the 72h/5-min series is ~2.4MB of JSON) and gzips
// ~10x. Next's `compress` option is bypassed under standalone + an external
// function gateway, so we compress here explicitly whenever the client accepts
// gzip. JSON is highly repetitive, so even gzip level 6 is a huge win for ~tens
// of ms of CPU on an in-memory buffer.

// CDN caching (mirrors /api/token-deals/live): the data only advances every
// 5 minutes (refresh boundary), so a short shared-cache TTL is lossless for
// freshness but lets the edge absorb repeat traffic. Browsers still always
// revalidate (max-age=0) — the client polls on its own schedule.
//   healthy → 60s at the edge + 4min serve-stale-while-revalidating
//   stale   → 15s (the origin is mid-refresh; let the edge retry soon)
//   error   → never cached
export type CachePolicy = "healthy" | "stale" | "error";

const CACHE_CONTROL: Record<CachePolicy, string> = {
  healthy: "public, max-age=0, s-maxage=60, stale-while-revalidate=240",
  stale: "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
  error: "no-store, max-age=0",
};

function jsonResponse(
  data: unknown,
  acceptEncoding: string,
  extraHeaders: Record<string, string>,
  cachePolicy: CachePolicy = "error",
  status = 200,
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": CACHE_CONTROL[cachePolicy],
    // Caches must key on Accept-Encoding since we vary the body by it.
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
    // Read-only runtime: serves the packaged JSON baseline + an incremental DB
    // tail query (baseline.to → now), merged in memory. Never writes to disk.
    const { payload, source, elapsedMs } = await getLiveTokenEconomicsWithMeta(
      searchParams.get("range"),
      new Date(),
    );
    return jsonResponse(
      payload,
      acceptEncoding,
      {
        // Diagnostics: inspect these in the browser Network panel to see which
        // layer served the request and how long the server spent on it.
        // l1-memory / baseline-fresh / single-flight = no DB; incremental-db =
        // one DB round-trip; full-db = full re-aggregation (slow); stale-swr =
        // refresh still running, stale served; stale-baseline = DB failed.
        "X-Cache-Source": source,
        "X-Server-Time": `${elapsedMs}ms`,
        "Server-Timing": `live;desc=${source};dur=${elapsedMs}`,
      },
      payload.stale ? "stale" : "healthy",
    );
  } catch (error) {
    if (error instanceof LiveDbConfigError) {
      return Response.json(
        {
          error: "Live usage database is not configured.",
          missing: error.missing,
        },
        { status: 503, headers: { "X-Cache-Source": "error-db-config" } },
      );
    }
    if (error instanceof LiveConfigError) {
      return Response.json(
        { error: error.message },
        { status: 400, headers: { "X-Cache-Source": "error-config" } },
      );
    }
    console.error("[token-economics/live] failed to load usage", error);
    return Response.json(
      { error: "Failed to load live token usage." },
      { status: 500, headers: { "X-Cache-Source": "error" } },
    );
  }
}
