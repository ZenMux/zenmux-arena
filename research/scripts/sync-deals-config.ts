#!/usr/bin/env tsx
// Sync the Token Deals roster: billing DB → config/token-deals.json.
//
// Pulls deal candidates (model_discount windows + `-free` models) and merges
// them INCREMENTALLY into the config — manual edits (early endDate, online,
// display) are never overwritten; nothing is ever deleted (see
// research/token-deals/sync.ts for the rules). Run it, review the printed
// roster, then hand-adjust the file if needed. The runtime only reads the
// config, so nothing goes live until the file is committed/deployed.
//
//   pnpm tokendeals:sync            # merge + write + print roster
//   pnpm tokendeals:sync --dry-run  # print what would change, write nothing

import { config as loadDotenv } from "dotenv";
import path from "node:path";
import {
  dealsConfigPath,
  loadDealsConfig,
  saveDealsConfig,
  type DealsConfigFile,
} from "@research/token-deals/deals-config";
import { discoverRosterFromDb, mergeDealsConfig } from "@research/token-deals/sync";
import { closeDealsDbPool } from "@research/token-deals/db";

loadDotenv({ path: path.resolve(process.cwd(), ".env.local") });

const DRY_RUN = process.argv.includes("--dry-run");

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function printRoster(config: DealsConfigFile): void {
  console.log("── 打折模型 ──────────────────────────────────────────────────────────");
  console.log(
    pad("slug", 36) + pad("发布", 12) + pad("开始", 12) + pad("结束", 12) + pad("折扣", 8) + pad("providers", 24) + pad("delisted", 10) + "display",
  );
  for (const e of config.discounts) {
    console.log(
      pad(e.slug, 36) +
        pad(e.publishDate ?? "—", 12) +
        pad(e.startDate, 12) +
        pad(e.endDate ?? "(进行中)", 12) +
        pad(`x${e.discount.toFixed(2)}`, 8) +
        pad(e.providers.map((p) => `${p.slug} x${p.discount.toFixed(2)}`).join(", "), 24) +
        pad(e.delisted ? "yes" : "-", 10) +
        (e.display ? "✓" : "✗"),
    );
  }
  console.log();
  console.log("── Free 模型 ─────────────────────────────────────────────────────────");
  console.log(pad("slug", 44) + pad("源模型", 36) + pad("发布", 12) + pad("online", 8) + "display");
  for (const e of config.freeModels) {
    console.log(
      pad(e.slug, 44) +
        pad(e.sourceSlug, 36) +
        pad(e.publishDate ?? "—", 12) +
        pad(e.online ? "✓" : "✗", 8) +
        (e.display ? "✓" : "✗"),
    );
  }
}

async function main() {
  console.log(`[tokendeals:sync] Config file: ${dealsConfigPath()}`);
  const existing = await loadDealsConfig();
  console.log(
    existing
      ? `[tokendeals:sync] Existing roster: ${existing.discounts.length} discounts, ${existing.freeModels.length} free models`
      : "[tokendeals:sync] No existing config — first sync creates it.",
  );

  console.log("[tokendeals:sync] Discovering candidates from the billing DB…");
  const discovered = await discoverRosterFromDb();
  console.log(
    `[tokendeals:sync] DB candidates: ${discovered.discounts.length} discount periods, ${discovered.freeModels.length} free models`,
  );

  const { config, report } = mergeDealsConfig(existing, discovered);

  console.log();
  console.log("── 变更摘要 ──────────────────────────────────────────────────────────");
  console.log(`  新增打折条目: ${report.addedDiscounts.length}${report.addedDiscounts.length ? "  ← " + report.addedDiscounts.map((e) => e.slug).join(", ") : ""}`);
  console.log(`  新增 Free 条目: ${report.addedFree.length}${report.addedFree.length ? "  ← " + report.addedFree.map((e) => e.slug).join(", ") : ""}`);
  console.log(`  实际回退关账: ${report.closedDiscounts.length}${report.closedDiscounts.length ? "  ← " + report.closedDiscounts.map((c) => `${c.slug}→${c.endDate}`).join(", ") : ""}`);
  console.log(`  播种预期下线日(expected_end_date): ${report.seededEndDates.length}${report.seededEndDates.length ? "  ← " + report.seededEndDates.map((c) => `${c.slug}→${c.endDate}`).join(", ") : ""}`);
  console.log(`  刷新进行中条目(系数/下架): ${report.refreshedDiscounts.length}${report.refreshedDiscounts.length ? "  ← " + report.refreshedDiscounts.join(", ") : ""}`);
  console.log();

  printRoster(config);
  console.log();

  if (DRY_RUN) {
    console.log("[tokendeals:sync] --dry-run: nothing written.");
  } else {
    await saveDealsConfig(config);
    console.log(`[tokendeals:sync] ✅ Wrote ${dealsConfigPath()}`);
    console.log("[tokendeals:sync] 请人工核对上表（窗口/折扣/online/display），需要隐藏的模型把 display 改为 false。");
  }
  await closeDealsDbPool();
}

main().catch(async (err) => {
  console.error("[tokendeals:sync] Fatal error:", err);
  await closeDealsDbPool();
  process.exit(1);
});
