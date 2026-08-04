/**
 * Source trail — where a touchpoint actually came from.
 *
 * Nothing in the cockpit is allowed to look like it appeared out of thin air.
 * Every touchpoint carries the system it was captured in, the reference inside
 * that system, and — when a model did the reading — how confident the
 * extraction was. Manual entry carries no confidence, because a person typed it.
 */

export interface SourceTrail {
  source_system: string;
  source_ref: string | null;
  source_captured_at: string | null;
  extraction_confidence: number | null;
  source_excerpt: string | null;
}

export type ConfidenceTone = "high" | "medium" | "low" | "manual";

/** Bands are deliberately wide — this is a signal, not a measurement. */
export function confidenceTone(value: number | null): ConfidenceTone {
  if (value === null) return "manual";
  if (value >= 0.8) return "high";
  if (value >= 0.6) return "medium";
  return "low";
}

export function confidenceLabel(value: number | null): string {
  if (value === null) return "Entered by hand";
  return `${value.toFixed(2)} confidence`;
}

export const SOURCE_NOTE: Record<string, string> = {
  Granola: "Meeting transcript, rating inferred from the notes",
  Aircall: "Call recording summary",
  "Gmail sync": "Thread metadata only — emails are never rated",
  "Manual entry": "Typed into the log activity form",
  "CRM import": "Bulk import from the previous CRM",
};

export interface SourceSummary {
  total: number;
  automated: number;
  manual: number;
  mean_confidence: number | null;
  systems: { system: string; count: number }[];
}

export function summariseSources(rows: SourceTrail[]): SourceSummary {
  const counts = new Map<string, number>();
  let confSum = 0;
  let confCount = 0;
  for (const row of rows) {
    counts.set(row.source_system, (counts.get(row.source_system) ?? 0) + 1);
    if (row.extraction_confidence !== null) {
      confSum += row.extraction_confidence;
      confCount += 1;
    }
  }
  return {
    total: rows.length,
    automated: confCount,
    manual: rows.length - confCount,
    mean_confidence: confCount === 0 ? null : confSum / confCount,
    systems: [...counts.entries()]
      .map(([system, count]) => ({ system, count }))
      .sort((a, b) => b.count - a.count),
  };
}
