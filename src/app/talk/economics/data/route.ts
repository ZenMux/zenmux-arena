import { loadEconomicsData } from "./loader";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  try {
    return Response.json(await loadEconomicsData(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "模型价格或发布窗口数据暂时不可用，请稍后重试。", retryable: true },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "10" } });
  }
}
