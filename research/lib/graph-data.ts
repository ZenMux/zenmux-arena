import type { GraphData } from "./types";

// Personality and identity studies share results/, but not an aggregate schema.
// Without this boundary the newest MBTI run crashes the identity viewer.
export function isIdentityGraph(value: unknown): value is GraphData {
  if (!value || typeof value !== "object") return false;
  const graph = value as Record<string, unknown>;
  return ["models", "languages", "vendors", "edges", "cells"].every((key) => Array.isArray(graph[key]))
    && !!graph.summary && typeof graph.summary === "object";
}
