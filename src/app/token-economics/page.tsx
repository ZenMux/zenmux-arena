// Token Economics — the landing surface. Server component that reads the
// published artifact (public/research/token-economics.json, written by
// `pnpm tokenecon`) and hands it to the client view. force-dynamic so a fresh
// scrape shows up on reload without a rebuild, exactly like /research/data.

import fs from "node:fs";
import path from "node:path";
import type { TokenEconomicsData } from "@research/token-economics/types";
import { TokenEconClient } from "./TokenEconClient";

export const dynamic = "force-dynamic";

function loadData(): TokenEconomicsData | null {
  const p = path.join(process.cwd(), "public", "research", "token-economics.json");
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as TokenEconomicsData;
  } catch {
    return null;
  }
}

export default function TokenEconomicsPage() {
  const data = loadData();

  if (!data || data.models.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-2xl font-bold uppercase tracking-tight">
          Token Economics
        </h1>
        <p className="mt-4 text-sm text-[#6f6a5f]">
          No data found. Scrape the ZenMux model listing, then reload:
        </p>
        <pre className="mt-4 overflow-x-auto border border-[#141414] bg-[#fbf9f4] p-4 text-xs">
          pnpm tokenecon
        </pre>
      </div>
    );
  }

  return <TokenEconClient data={data} />;
}
