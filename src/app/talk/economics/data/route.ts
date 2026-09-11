import { after } from "next/server";
import { loadEconomicsData } from "./loader";

export const runtime = "nodejs";
export const revalidate = 0;
export const maxDuration = 60;

// Concurrent map/ladder visitors and retries join the same bounded-concurrency
// launch-window batch. No persistent cache, billing maintenance or model calls.
let inFlight: ReturnType<typeof loadEconomicsData> | null = null;
const RESPONSE_TIMEOUT_MS = 30_000;

export async function GET() {
  if (!inFlight) {
    inFlight = loadEconomicsData().finally(() => { inFlight = null; });
  }
  const work = inFlight;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("deadline")), RESPONSE_TIMEOUT_MS);
      }),
    ]);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const timedOut = error instanceof Error && error.message === "deadline";
    // Shared helpers have no AbortSignal parameter. Keep the existing bounded
    // launch-window work alive to warm its 24h Data Cache after returning 504;
    // retry joins it rather than starting another batch. Never replace fetch.
    if (timedOut) after(async () => { await work.catch(() => undefined); });
    return Response.json(
      { error: timedOut
        ? "发布窗口数据读取超过 30 秒，请稍后重试。已有请求会继续填充 24 小时缓存。"
        : "模型价格或发布窗口数据暂时不可用，请重试。", retryable: true },
      { status: timedOut ? 504 : 502, headers: { "Cache-Control": "no-store", "Retry-After": "10" } },
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}
