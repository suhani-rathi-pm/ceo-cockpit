/**
 * Runtime parameters — the numbers the schematic calls "tunable without a
 * redeploy". Defaults live here; edited values live in app_settings under the
 * `param.` prefix and are overlaid onto CONFIG / NEWS_CONFIG at run time.
 *
 * Changing a value never re-scores history. The next run picks it up.
 */

export interface ParamDef {
  key: string;
  label: string;
  group: "Scoring" | "Classification" | "News";
  default: number;
  min: number;
  max: number;
  step: number;
  note: string;
}

export const PARAM_DEFS: ParamDef[] = [
  { key: "seniority.cSuite", label: "Seniority · C-suite or owner", group: "Scoring", default: 5, min: 0, max: 10, step: 1, note: "CEO, CFO, President, Founder" },
  { key: "seniority.vp", label: "Seniority · VP", group: "Scoring", default: 4, min: 0, max: 10, step: 1, note: "VP, SVP, EVP" },
  { key: "seniority.director", label: "Seniority · Director", group: "Scoring", default: 3, min: 0, max: 10, step: 1, note: "Director, Head of" },
  { key: "seniority.manager", label: "Seniority · Manager", group: "Scoring", default: 2, min: 0, max: 10, step: 1, note: "Manager, Sr. Manager" },
  { key: "seniority.other", label: "Seniority · everyone else", group: "Scoring", default: 1, min: 0, max: 10, step: 1, note: "Blank or unmatched titles" },

  { key: "opportunity.$1M+", label: "Opportunity · $1M+", group: "Scoring", default: 5, min: 0, max: 10, step: 1, note: "" },
  { key: "opportunity.$250k-1M", label: "Opportunity · $250k-1M", group: "Scoring", default: 4, min: 0, max: 10, step: 1, note: "" },
  { key: "opportunity.$50k-250k", label: "Opportunity · $50k-250k", group: "Scoring", default: 3, min: 0, max: 10, step: 1, note: "" },
  { key: "opportunity.<$50k", label: "Opportunity · under $50k", group: "Scoring", default: 2, min: 0, max: 10, step: 1, note: "" },
  { key: "opportunity.Unknown", label: "Opportunity · unknown", group: "Scoring", default: 1, min: 0, max: 10, step: 1, note: "Not yet asked" },
  { key: "opportunity.None identified", label: "Opportunity · none identified", group: "Scoring", default: 0, min: 0, max: 10, step: 1, note: "Asked and confirmed zero" },

  { key: "icp.High", label: "ICP multiplier · High", group: "Scoring", default: 1.2, min: 0.1, max: 3, step: 0.05, note: "" },
  { key: "icp.Medium", label: "ICP multiplier · Medium", group: "Scoring", default: 1.0, min: 0.1, max: 3, step: 0.05, note: "" },
  { key: "icp.Low", label: "ICP multiplier · Low", group: "Scoring", default: 0.8, min: 0.1, max: 3, step: 0.05, note: "" },
  { key: "icp.Unknown", label: "ICP multiplier · missing", group: "Scoring", default: 1.0, min: 0.1, max: 3, step: 0.05, note: "Neutral by design — never a penalty" },

  { key: "emailRatingPlaceholder", label: "Email rating placeholder", group: "Scoring", default: 2.5, min: 0, max: 5, step: 0.1, note: "Emails carry no star rating" },
  { key: "granolaNoteWeight", label: "Granola note weight", group: "Scoring", default: 1.0, min: 0.1, max: 2, step: 0.05, note: "Applied to call ratings inferred from transcripts" },

  { key: "topRankCutoff", label: "Pipeline cutoff", group: "Classification", default: 6, min: 1, max: 20, step: 1, note: "How many ranks count as top" },
  { key: "staleAfterDays", label: "Stale threshold", group: "Classification", default: 60, min: 7, max: 365, step: 1, note: "Days of silence before exclusion" },
  { key: "recentTouchpointDays", label: "Recent window", group: "Classification", default: 7, min: 1, max: 60, step: 1, note: "Separates Pipeline from Opportunity" },

  { key: "news.minRelevance", label: "News relevance floor", group: "News", default: 0.5, min: 0, max: 1, step: 0.01, note: "Below this an item never reaches the briefing" },
  { key: "news.maxItems", label: "News items shown", group: "News", default: 8, min: 1, max: 30, step: 1, note: "Daily cap before the briefing stops being read" },
];

export const PARAM_GROUPS = ["Scoring", "Classification", "News"] as const;

export type RuntimeParams = Record<string, number>;

export const DEFAULT_PARAMS: RuntimeParams = Object.fromEntries(
  PARAM_DEFS.map((d) => [d.key, d.default]),
);

export function paramDef(key: string): ParamDef | undefined {
  return PARAM_DEFS.find((d) => d.key === key);
}

/** Clamps and rounds a submitted value to its definition. */
export function coerceParam(key: string, value: number): number {
  const def = paramDef(key);
  if (!def) return value;
  const clamped = Math.min(def.max, Math.max(def.min, value));
  return Math.round(clamped * 1000) / 1000;
}

/** Which values differ from the shipped defaults. */
export function tunedKeys(params: RuntimeParams): string[] {
  return PARAM_DEFS.filter((d) => (params[d.key] ?? d.default) !== d.default).map((d) => d.key);
}
