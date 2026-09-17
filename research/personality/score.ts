import type {
  DimensionAggregate,
  DimensionScore,
  ModelPersonalityAggregate,
  OejtsAnswer,
  OejtsDimension,
  OejtsInstrument,
  PersonalityConfig,
  PersonalityModelSpec,
  PersonalityRecord,
  ScoredAdministration,
} from "./types";

const DIMENSIONS: OejtsDimension[] = ["IE", "SN", "FT", "JP"];

function fail(message: string): never {
  throw new Error(`[oejts-score] ${message}`);
}

function parseJsonCandidate(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) {
      try {
        return JSON.parse(fenced.trim());
      } catch {
        // Fall through to the balanced outer-object salvage below.
      }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("response does not contain a JSON object");
  }
}

export function parseOejtsResponse(raw: string): OejtsAnswer[] {
  let parsed: unknown;
  try {
    parsed = parseJsonCandidate(raw);
  } catch (error) {
    fail(`invalid JSON: ${(error as Error).message}`);
  }

  const responses = (parsed as { responses?: unknown })?.responses;
  if (!Array.isArray(responses)) fail("responses must be an array");
  if (responses.length !== 32) fail(`expected 32 responses, found ${responses.length}`);

  const answers: OejtsAnswer[] = [];
  const seen = new Set<number>();
  for (const entry of responses) {
    const id = (entry as { id?: unknown })?.id;
    const score = (entry as { score?: unknown })?.score;
    if (!Number.isInteger(id) || (id as number) < 1 || (id as number) > 32) {
      fail(`invalid item id: ${String(id)}`);
    }
    if (seen.has(id as number)) fail(`duplicate item id: ${id}`);
    if (!Number.isInteger(score) || (score as number) < 1 || (score as number) > 5) {
      fail(`Q${id} score must be an integer from 1 to 5`);
    }
    seen.add(id as number);
    answers.push({ id: id as number, score: score as number });
  }
  return answers.sort((a, b) => a.id - b.id);
}

export function scoreAdministration(
  instrument: OejtsInstrument,
  key: string,
  repeat: number,
  answers: OejtsAnswer[],
): ScoredAdministration {
  if (answers.length !== 32) fail(`expected 32 answers for ${key}`);
  const byId = new Map(answers.map((answer) => [answer.id, answer.score]));
  if (byId.size !== 32) fail(`answers for ${key} contain duplicate ids`);

  const dimensions = {} as Record<OejtsDimension, DimensionScore>;
  let type = "";
  for (const dimension of DIMENSIONS) {
    const rule = instrument.scoring[dimension];
    let score = rule.const;
    for (const [id, sign] of Object.entries(rule.signs)) {
      const answer = byId.get(Number(id));
      if (answer === undefined) fail(`missing Q${id} for ${key}`);
      if (!Number.isInteger(answer) || answer < 1 || answer > 5) fail(`invalid Q${id} for ${key}`);
      score += sign * answer;
    }
    if (score < 8 || score > 40) fail(`${dimension} score ${score} is outside 8..40`);

    const letter = score > rule.threshold ? rule.highLetter : rule.lowLetter;
    type += letter;
    dimensions[dimension] = {
      dimension,
      score,
      threshold: rule.threshold,
      letter,
      boundary: score === rule.threshold,
      highLetterPercent: ((score - 8) / 32) * 100,
    };
  }

  return { key, repeat, type, dimensions };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStandardDeviation(values: number[], average: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

export function aggregateModel(
  model: PersonalityModelSpec,
  records: PersonalityRecord[],
  instrument: OejtsInstrument,
  classification: PersonalityConfig["classification"],
): ModelPersonalityAggregate {
  if (records.length !== 16) fail("exactly 16 valid administrations are required before classification");
  const administrations = records
    .map((record) => {
      if (!record.answers || record.error || record.parseError) {
        fail(`record ${record.key} is not a valid administration`);
      }
      return scoreAdministration(instrument, record.key, record.repeat, record.answers);
    })
    .sort((a, b) => a.repeat - b.repeat);

  const typeCounts = countBy(administrations.map((administration) => administration.type));
  const rankedTypes = Object.entries(typeCounts).sort(
    ([typeA, countA], [typeB, countB]) => countB - countA || typeA.localeCompare(typeB),
  );
  const modalType = rankedTypes[0]?.[0] ?? null;
  const modalCount = rankedTypes[0]?.[1] ?? 0;
  const uniqueMode = modalType !== null && (rankedTypes[1]?.[1] ?? -1) < modalCount;

  const letterCounts = countBy(
    administrations.flatMap((administration) => administration.type.split("")),
  );
  const reasons: string[] = [];
  if (!uniqueMode) reasons.push("完整类型没有唯一众数");
  const minModalCount = Math.floor(administrations.length / 2) + 1;
  if (classification.minModalCount !== minModalCount) fail("classification must use a strict majority");
  if (modalCount < minModalCount) {
    reasons.push(`最高频完整类型仅出现 ${modalCount}/${administrations.length} 次，低于 ${classification.minModalCount} 次`);
  }

  const dimensionAggregates = {} as Record<OejtsDimension, DimensionAggregate>;
  for (const dimension of DIMENSIONS) {
    const values = administrations.map((administration) => administration.dimensions[dimension].score);
    const average = mean(values);
    const rule = instrument.scoring[dimension];
    dimensionAggregates[dimension] = {
      dimension,
      mean: average,
      standardDeviation: sampleStandardDeviation(values, average),
      min: Math.min(...values),
      max: Math.max(...values),
      highLetter: rule.highLetter,
      highLetterCount: administrations.filter(
        (administration) => administration.dimensions[dimension].letter === rule.highLetter,
      ).length,
      lowLetter: rule.lowLetter,
      lowLetterCount: administrations.filter(
        (administration) => administration.dimensions[dimension].letter === rule.lowLetter,
      ).length,
      boundaryCount: administrations.filter(
        (administration) => administration.dimensions[dimension].boundary,
      ).length,
    };
  }

  const stable = reasons.length === 0;
  return {
    modelId: model.id,
    baseModelId: model.baseModelId,
    manufacturer: model.manufacturer,
    providerSlug: model.providerSlug,
    label: model.label,
    n: administrations.length,
    typeCounts,
    modalType,
    modalCount,
    stableType: stable ? modalType : null,
    status: stable ? "stable" : "no_stable_type",
    reasons,
    letterCounts,
    dimensions: dimensionAggregates,
    administrations,
  };
}
