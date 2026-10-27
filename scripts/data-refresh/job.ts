import { payloadHash, type SnapshotPayload } from "@research/cache/payload";
import type { SnapshotStore } from "./supabase-writer";

export type JobResult = { status: "updated" | "current" | "busy"; to?: string; stale?: boolean };

/** Query outside transactions, publish under a fenced lease, verify JSONB round trip. */
export async function runSnapshotJob<T extends SnapshotPayload>(o: {
  store: SnapshotStore<T>;
  valid: (value: unknown) => value is T;
  fresh: (value: T) => boolean;
  build: (baseline: T | null) => Promise<T>;
  force?: boolean;
}): Promise<JobResult> {
  const owner = await o.store.acquire();
  if (!owner) return { status: "busy" };
  try {
    const raw = await o.store.read();
    const baseline = o.valid(raw) ? raw : null;
    if (baseline && !o.force && o.fresh(baseline)) return { status: "current", to: baseline.to, stale: false };
    const built = await o.build(baseline);
    if (!o.valid(built)) throw new Error("Refusing to publish an unusable snapshot.");
    if (baseline && Date.parse(built.to) < Date.parse(baseline.to)) throw new Error("Snapshot cutoff would move backwards.");
    const payload = { ...built, stale: !o.fresh(built) };
    if (!await o.store.publish(payload, owner)) throw new Error("Snapshot publish was fenced out; lease expired or newer data exists.");
    const persisted = await o.store.read();
    if (!o.valid(persisted) || payloadHash(persisted) !== payloadHash(payload)) throw new Error("Snapshot read-back verification failed.");
    return { status: "updated", to: persisted.to, stale: persisted.stale };
  } finally {
    await o.store.release(owner);
  }
}

/** Never include connection addresses, usernames, SQL text or SDK request objects in logs. */
export function safeFailure(error: unknown): string {
  let cause = error;
  for (let depth = 0; depth < 4 && cause && typeof cause === "object"; depth++) {
    if ("code" in cause && typeof cause.code === "string") {
      return `Operation failed (${cause.code.replace(/[^A-Z0-9_]/gi, "").slice(0, 40)}).`;
    }
    if (cause instanceof Error && /^Model usage request failed \(HTTP \d{3}\)\.$/.test(cause.message)) return cause.message;
    cause = "cause" in cause ? cause.cause : undefined;
  }
  if (error instanceof Error && /^(Missing [A-Z_]+\.|Refusing to publish|Snapshot |Model listing|Comparison aggregation|Model usage)/.test(error.message)) {
    return error.message;
  }
  return "Data refresh failed; previous published data was retained.";
}
