import { env } from "cloudflare:workers";
import runs from "virtual:arena-browse";
import { isPseudoVendor } from "@research/lib/vendors";
import type { VendorId } from "@research/lib/types";
import type { ModelEntry, RunData, RunRef } from "../src/app/who-are-you/browse/data";
export type { JoinedAnswer, LangGroup, ModelEntry, RunRef, VendorDisplay } from "../src/app/who-are-you/browse/data";

export function discoverRuns(): RunRef[] {
  return Object.values(runs).map((run) => run.ref).sort((a, b) => b.stamp.localeCompare(a.stamp));
}
// Joining all source JSONL per request exceeds Worker memory. The build
// runs the original join once, then ships metadata plus one immutable model
// shard per read. No model calls, live DB reads, or client-side raw dataset.
export async function loadRunData(run: string, modelId?: string): Promise<RunData | null> {
  if (!Object.hasOwn(runs, run)) return null;
  const data = runs[run];
  const selected = data.models.find((model) => model.id === modelId) ?? data.models[0];
  if (!selected) return { ref: data.ref, models: [], totalAnswers: data.totalAnswers };
  const response = await env.ASSETS.fetch(new Request(`http://localhost${selected.asset}`));
  if (!response.ok) throw new Error(`Packaged research model unavailable (${response.status})`);
  const full = await response.json() as ModelEntry;
  return { ref: data.ref, totalAnswers: data.totalAnswers, models: data.models.map(({ asset: _asset, ...model }) => {
    void _asset;
    return model.id === selected.id ? full : model;
  }) };
}
export function isBucket(id: VendorId): boolean { return isPseudoVendor(id) && id !== "other"; }
