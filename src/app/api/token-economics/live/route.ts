import {
  getLiveTokenEconomics,
  LiveConfigError,
  LiveDbConfigError,
} from "@research/token-economics/live-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    // Read-only runtime: serves the packaged JSON baseline + an incremental DB
    // tail query (baseline.to → now), merged in memory. Never writes to disk.
    const data = await getLiveTokenEconomics(searchParams.get("range"), new Date());
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
    console.error("[token-economics/live] failed to load usage", error);
    return Response.json(
      { error: "Failed to load live token usage." },
      { status: 500 },
    );
  }
}
