// Scraper for the ZenMux models listing. The page is server-rendered (~1.5MB of
// HTML), and the model economics live in TWO stacked layers — we read both and
// join them, because each holds something the other lacks:
//
//   1. A <script type="application/ld+json"> ItemList — the AUTHORITATIVE price
//      string ("Prompt: $X / 1M tokens; Completion: $Y / 1M tokens"), provider,
//      and context window, for every listed model (~155).
//   2. The rendered DOM cards — the same prices PLUS the one signal JSON-LD omits:
//      observed token-consumption volume ("896.98M tokens"), context, max output,
//      and the provider count. (~93 text models.)
//
// Strategy: the CARD set is the universe (it's already filtered to text models and
// it carries usage); JSON-LD backfills any card whose inline price didn't parse.
// This is pure string/regex parsing — no headless browser — so it runs in CI and
// stays fast. The shapes here are intentionally defensive: ZenMux can restyle the
// page, and a single broken card must not abort the scrape.

import type { ScrapedModel } from "./normalize";

export const MODELS_URL =
  "https://zenmux.ai/models?sort=newest&output_modalities=text";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Fetch the listing HTML. Throws on a non-2xx so the CLI can surface it. */
export async function fetchModelsHtml(url = MODELS_URL): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!res.ok) {
    throw new Error(`GET ${url} → HTTP ${res.status} ${res.statusText}`);
  }
  return res.text();
}

// ---------------------------------------------------------------------------
// Number parsing helpers
// ---------------------------------------------------------------------------

/** "$2.00/M tokens" | "$15.0/M" → 2.0 / 15.0 ; null if no dollar figure. */
function dollarsPerM(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/\$\s*([\d.]+)/);
  return m ? Number(m[1]) : null;
}

/** "896.98M" | "1.05M" | "2,606.77M" | "99.11K" | "1.2B" → absolute number. */
function magnitude(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.replace(/,/g, "").match(/([\d.]+)\s*([BMK]?)/i);
  if (!m) return null;
  const mult =
    { B: 1e9, M: 1e6, K: 1e3, "": 1 }[m[2].toUpperCase() as "B" | "M" | "K" | ""] ?? 1;
  return Number(m[1]) * mult;
}

// ---------------------------------------------------------------------------
// Layer 1 — JSON-LD ItemList (authoritative price + context)
// ---------------------------------------------------------------------------

interface LdEntry {
  inputPrice: number | null;
  outputPrice: number | null;
  contextWindow: number | null;
  name: string | null;
}

/** slug → price/context from the embedded JSON-LD ItemList. Best-effort. */
function parseJsonLd(html: string): Map<string, LdEntry> {
  const out = new Map<string, LdEntry>();
  const blocks = [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ];
  for (const b of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(b[1]);
    } catch {
      continue;
    }
    const list = (data as { itemListElement?: unknown[] })?.itemListElement;
    if (!Array.isArray(list)) continue;
    for (const el of list) {
      const item = (el as { item?: Record<string, unknown> })?.item;
      const url = item?.url as string | undefined;
      if (!item || typeof url !== "string") continue;
      const slug = slugFromUrl(url);
      if (!slug) continue;
      const props = (item.additionalProperty as
        | { name?: string; value?: string }[]
        | undefined) ?? [];
      const priceStr = props.find((p) => p.name === "Price")?.value ?? "";
      const ctxStr = props.find((p) => p.name === "Context window")?.value ?? "";
      const inM = priceStr.match(/Prompt:\s*\$([\d.]+)/);
      const outM = priceStr.match(/Completion:\s*\$([\d.]+)/);
      out.set(slug, {
        inputPrice: inM ? Number(inM[1]) : null,
        outputPrice: outM ? Number(outM[1]) : null,
        contextWindow: magnitude(ctxStr),
        name: (item.name as string) ?? null,
      });
    }
  }
  return out;
}

/** "https://zenmux.ai/openai/gpt-4.1" → "openai/gpt-4.1". */
function slugFromUrl(url: string): string | null {
  const i = url.indexOf("zenmux.ai/");
  if (i < 0) return null;
  return url.slice(i + "zenmux.ai/".length).replace(/^\/+|\/+$/g, "") || null;
}

// ---------------------------------------------------------------------------
// Layer 2 — DOM cards (usage volume + inline price + context/maxOut/providers)
// ---------------------------------------------------------------------------

/** Pull a labelled data-item value: <span>LABEL</span><span class="…">VALUE</span>. */
function dataItem(card: string, label: string): string | null {
  const re = new RegExp(
    `>${label}</span><span class="[^"]*">([^<]+)</span>`,
  );
  return card.match(re)?.[1]?.trim() ?? null;
}

// ---------------------------------------------------------------------------
// Public entry: scrape → joined raw rows
// ---------------------------------------------------------------------------

/**
 * Parse the listing HTML into raw model rows. Card set is the universe; JSON-LD
 * backfills missing prices. Rows with no resolvable price are still returned
 * (price = null) so the CLI can report what it dropped instead of silently
 * shrinking the count.
 */
export function parseModels(html: string): ScrapedModel[] {
  const ld = parseJsonLd(html);

  // Cards are delimited by the "container-waZkVt1m" class marker. Splitting on it
  // gives one segment per card (plus a leading non-card preamble we skip via the
  // slug guard below).
  const segments = html.split("container-waZkVt1m");
  const rows: ScrapedModel[] = [];

  for (const seg of segments) {
    const slugM = seg.match(
      /<div class="subinfo-mtUC_CN2"><span>([a-z0-9._-]+\/[A-Za-z0-9._:-]+)<\/span>/,
    );
    if (!slugM) continue;
    const slug = slugM[1];

    const nameM = seg.match(/<span class="multi-line[^"]*"[^>]*>([^<]+)<\/span>/);
    const usageM = seg.match(
      /<div class="token-[^"]*">([\d.,]+[BMK]?) tokens<\/div>/i,
    );
    const providersM = seg.match(/Available on (\d+) provider/);

    const cardIn = dollarsPerM(dataItem(seg, "Input"));
    const cardOut = dollarsPerM(dataItem(seg, "Output"));
    const ldEntry = ld.get(slug);

    // JSON-LD wins for price when present (it's the authoritative quote), card is
    // the fallback. Either source independently can supply input or output.
    const inputPrice = ldEntry?.inputPrice ?? cardIn;
    const outputPrice = ldEntry?.outputPrice ?? cardOut;

    rows.push({
      slug,
      name: nameM?.[1]?.trim() ?? ldEntry?.name ?? slug,
      inputPrice,
      outputPrice,
      usageRaw: usageM?.[1] ? `${usageM[1]} tokens` : null,
      usageTokens: magnitude(usageM?.[1]),
      contextWindow: magnitude(dataItem(seg, "Context")) ?? ldEntry?.contextWindow ?? null,
      maxOutput: magnitude(dataItem(seg, "Max Output")),
      providers: providersM ? Number(providersM[1]) : null,
    });
  }

  return rows;
}
