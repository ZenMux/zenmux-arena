import artifact from "./deepseek-challenge-2026-06-23--2026-08-23.json";
import type { HistoricalEconomicsData } from "./types";

// Static import: no fetch, Supabase client, environment access or runtime IO.
export const deepSeekChallengeHistory = artifact as HistoricalEconomicsData;
export type { HistoricalEconomicsData } from "./types";
