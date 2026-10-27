import type { TokenDealsPayload, DealUsagePoint, DealStats } from "./types";

const MONEY_DECIMALS = 4;

function roundMoney(n: number): number {
  return Number(n.toFixed(MONEY_DECIMALS));
}

function compactPoint(p: DealUsagePoint): DealUsagePoint {
  return {
    ...p,
    paid: roundMoney(p.paid),
    saved: roundMoney(p.saved),
    subPaid: roundMoney(p.subPaid),
    subSaved: roundMoney(p.subSaved),
  };
}

function compactStats(s: DealStats): DealStats {
  return {
    ...s,
    paid: roundMoney(s.paid),
    saved: roundMoney(s.saved),
    subPaid: roundMoney(s.subPaid),
    subSaved: roundMoney(s.subSaved),
  };
}

/** Round every money field in the payload to MONEY_DECIMALS. Idempotent. */
export function compactDealsPayload(payload: TokenDealsPayload): TokenDealsPayload {
  return {
    ...payload,
    totals: payload.totals
      ? {
          ...payload.totals,
          saved: roundMoney(payload.totals.saved),
          paid: roundMoney(payload.totals.paid),
          subSaved: roundMoney(payload.totals.subSaved),
          subPaid: roundMoney(payload.totals.subPaid),
        }
      : null,
    deals: payload.deals.map((deal) => ({
      ...deal,
      stats: deal.stats ? compactStats(deal.stats) : null,
      points: deal.points ? deal.points.map(compactPoint) : null,
    })),
  };
}

