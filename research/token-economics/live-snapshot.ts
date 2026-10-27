import { snapshotId, snapshotKey, validEconomics } from "../cache/payload";
import { supabaseSnapshotStore } from "../cache/supabase";
import { sharedSnapshotCache } from "../cache/read-through";
import { liveRangeOption, type LiveTokenEconomicsPayload } from "./live-config";

export async function getLiveTokenEconomicsWithMeta(requestedRange: string | null | undefined, now = new Date()) {
  const range = liveRangeOption(requestedRange).key;
  const id = snapshotId("token-economics", range);
  const result = await sharedSnapshotCache().get<LiveTokenEconomicsPayload>({
    key: snapshotKey(id), store: supabaseSnapshotStore(id), now,
    valid: (value): value is LiveTokenEconomicsPayload => validEconomics(value, range),
    fresh: (p, at) => {
      const step = Math.max(p.bucketSeconds, p.refreshIntervalSeconds) * 1000;
      return Date.parse(p.to) >= Math.floor(at.getTime() / step) * step;
    },
  });
  return { ...result, payload: { ...result.payload,
    dataLagSeconds: Math.max(0, Math.floor((now.getTime() - Date.parse(result.payload.to)) / 1000)),
  } };
}
