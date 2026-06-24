import {
  fetchLiveTokenEconomics,
  LiveConfigError,
  LiveDbConfigError,
} from "@research/token-economics/live-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const preferJsonCache = process.env.TOKEN_ECON_PREFER_JSON_CACHE === "1";
  try {
    const data = await fetchLiveTokenEconomics(searchParams.get("range"), new Date(), { preferJsonCache });
    return Response.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    if (error instanceof LiveDbConfigError) {
      return Response.json(
        {
          error: "Live usage database is not configured.",
          missing: error.missing,
        },
        { status: 503 },
      );
    }
    if (error instanceof LiveConfigError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    // If preferJsonCache is enabled, try fetching from DB as last resort instead of failing
    if (preferJsonCache) {
      try {
        const range = searchParams.get("range");
        // First call (preferJsonCache: true) threw because no JSON cache exists
        // Fall back to DB fetch (preferJsonCache: false bypasses the Level-3 throw)
        const data = await fetchLiveTokenEconomics(range, new Date(), { preferJsonCache: false });
        return Response.json({ ...data, generatedAt: new Date().toISOString() }, {
          headers: { "Cache-Control": "no-store, max-age=0" },
        });
      } catch (staleErr) {
        console.error("[token-economics/live] failed to load even stale data", staleErr);
      }
    }
    console.error("[token-economics/live] failed to load usage", error);
    return Response.json(
      { error: "Failed to load live token usage." },
      { status: 500 },
    );
  }
}
