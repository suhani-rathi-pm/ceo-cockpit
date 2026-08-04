/**
 * CEO Intelligence Layer — deterministic scoring engine.
 *
 * This module is PURE: no network, no randomness, no clock reads except the
 * explicit `now` argument passed in. The same input always produces the same
 * output, which makes the scores auditable and testable.
 *
 * Pipeline (see the spec steps inline below):
 *   1. seniority weight  (from contact title)
 *   2. opportunity weight (from est_opportunity_size)
 *   3. adjusted rating    (star rating x CRM credibility multiplier)
 *   4. touchpoint score   (1 x 2 x 3)
 *   5. company rollup     (SUM of touchpoint scores — rewards volume)
 *   6. ICP multiplier     -> final_score
 *   7. exclusions         (stale 60+ days, or is_active = false)
 *   8. classification     (Pipeline / Opportunity / Keep in touch; Lost is manual)
 */

// ---------------------------------------------------------------------------
// CONFIG — every tunable number lives here. Change weights in one place only.
// ---------------------------------------------------------------------------
export const CONFIG = {
  /** Step 1 — seniority weight per tier, matched from the contact's title. */
  seniorityWeights: {
    cSuite: 5, // CEO, COO, CFO, CTO, President, Founder, Owner, Chief ...
    vp: 4, // VP, SVP, EVP, Vice President
    director: 3, // Director, Head of
    manager: 2, // Manager, Sr. Manager
    other: 1, // anything else, or blank / missing contact
  },

  /** Step 2 — opportunity size weights. Unknown (1) != None identified (0). */
  opportunityWeights: {
    "$1M+": 5,
    "$250k-1M": 4,
    "$50k-250k": 3,
    "<$50k": 2,
    Unknown: 1,
    "None identified": 0,
  } as Record<string, number>,

  /** Step 3 — Email touchpoints carry no star rating; use this placeholder. */
  emailRatingPlaceholder: 2.5,

  /**
   * Step 4 — GRANOLA_NOTE_WEIGHT. Call touchpoints arrive from Granola call
   * notes, where the rating is inferred from a transcript rather than typed by
   * the CRM. This weight lets a run trust that inference more or less than a
   * hand-entered rating. 1.0 = treated identically.
   */
  granolaNoteWeight: 1.0,

  /** Fallback multiplier when a touchpoint has no CRM attached. */
  defaultCredibilityMultiplier: 1.0,

  /** Step 6 — ICP fit multipliers. Missing/Unknown is NEUTRAL, never penalised. */
  icpMultipliers: {
    High: 1.2,
    Medium: 1.0,
    Low: 0.8,
    Unknown: 1.0,
  } as Record<string, number>,
  icpNeutralMultiplier: 1.0,

  /** Step 7 — a company with no touchpoint within this window is excluded. */
  staleAfterDays: 60,

  /** Step 8 — how many ranks count as "top" for Pipeline / Opportunity. */
  topRankCutoff: 6,

  /** Step 8 — recency window that separates Pipeline from Opportunity. */
  recentTouchpointDays: 7,
};

/**
 * Overlays tuned runtime parameters onto CONFIG before a run. Values come from
 * the parameter store, so weights are tunable without a redeploy. Nothing here
 * re-scores history — the next run picks the new numbers up.
 */
export function applyScoringParams(params: Record<string, number>) {
  const set = (key: string, apply: (v: number) => void) => {
    const v = params[key];
    if (typeof v === "number" && Number.isFinite(v)) apply(v);
  };
  set("seniority.cSuite", (v) => (CONFIG.seniorityWeights.cSuite = v));
  set("seniority.vp", (v) => (CONFIG.seniorityWeights.vp = v));
  set("seniority.director", (v) => (CONFIG.seniorityWeights.director = v));
  set("seniority.manager", (v) => (CONFIG.seniorityWeights.manager = v));
  set("seniority.other", (v) => (CONFIG.seniorityWeights.other = v));
  for (const size of ["$1M+", "$250k-1M", "$50k-250k", "<$50k", "Unknown", "None identified"]) {
    set(`opportunity.${size}`, (v) => (CONFIG.opportunityWeights[size] = v));
  }
  for (const fit of ["High", "Medium", "Low", "Unknown"]) {
    set(`icp.${fit}`, (v) => (CONFIG.icpMultipliers[fit] = v));
  }
  set("emailRatingPlaceholder", (v) => (CONFIG.emailRatingPlaceholder = v));
  set("granolaNoteWeight", (v) => (CONFIG.granolaNoteWeight = v));
  set("staleAfterDays", (v) => (CONFIG.staleAfterDays = v));
  set("topRankCutoff", (v) => (CONFIG.topRankCutoff = v));
  set("recentTouchpointDays", (v) => (CONFIG.recentTouchpointDays = v));
  return CONFIG;
}


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type CompanyState = "Pipeline" | "Opportunity" | "Keep in touch" | "Lost";

export interface ScoringCompany {
  id: string;
  name: string;
  icp_fit: string | null;
  icp_subscores: unknown | null;
  is_active: boolean;
}

export interface ScoringContact {
  id: string;
  title: string | null;
}

export interface ScoringCrm {
  id: string;
  credibility_multiplier: number | string;
}

export interface ScoringTouchpoint {
  id: string;
  company_id: string;
  contact_id: string | null;
  crm_id: string | null;
  type: string;
  star_rating: number | null;
  est_opportunity_size: string | null;
  occurred_at: string;
}

export interface TouchpointBreakdown {
  touchpoint_id: string;
  type: string;
  occurred_at: string;
  contact_title: string | null;
  seniority_weight: number;
  opportunity_size: string;
  opportunity_weight: number;
  star_rating: number | null;
  used_email_placeholder: boolean;
  credibility_multiplier: number;
  adjusted_rating: number;
  score: number;
}

export interface CompanyScore {
  company_id: string;
  company_name: string;
  raw_score: number; // step 5 rollup
  icp_fit: string;
  icp_multiplier: number;
  icp_missing: boolean;
  final_score: number; // step 6
  rank: number | null; // rank among non-excluded companies, 1 = best
  excluded: boolean;
  exclusion_reasons: string[];
  touchpoint_count: number;
  last_touchpoint_at: string | null;
  days_since_last_touchpoint: number | null;
  has_recent_touchpoint: boolean;
  classified_state: CompanyState | null; // null when excluded
  reason: string; // plain-English explanation for state_history
  score_breakdown: {
    config: typeof CONFIG;
    touchpoints: TouchpointBreakdown[];
    rollup: number;
    icp: { fit: string; multiplier: number; missing: boolean };
    final_score: number;
    exclusion: { excluded: boolean; reasons: string[] };
    classification: {
      state: CompanyState | null;
      rank: number | null;
      top_cutoff: number;
      has_recent_touchpoint: boolean;
      recent_window_days: number;
      reason: string;
    };
  };
}

// ---------------------------------------------------------------------------
// Step 1 — seniority weight from a free-text job title
// ---------------------------------------------------------------------------
export function seniorityWeight(title: string | null | undefined): number {
  const t = (title ?? "").trim().toLowerCase();
  if (!t) return CONFIG.seniorityWeights.other;

  // C-suite / Owner / Founder — matched first because titles like
  // "Founder & CEO" or "President" outrank any later pattern.
  if (
    /\b(ceo|coo|cfo|cto|cio|cmo|cro|chro)\b/.test(t) ||
    /\bchief\b/.test(t) ||
    /\bpresident\b/.test(t) ||
    /\bfounder\b/.test(t) ||
    /\bco-?founder\b/.test(t) ||
    /\bowner\b/.test(t) ||
    /\bmanaging director\b/.test(t) ||
    /\bpartner\b/.test(t)
  ) {
    // "Vice President" contains "president" but is a VP, not C-suite.
    if (/\bvice president\b/.test(t) || /\b(svp|evp|vp)\b/.test(t)) {
      return CONFIG.seniorityWeights.vp;
    }
    return CONFIG.seniorityWeights.cSuite;
  }

  // VP tier
  if (/\b(vp|svp|evp)\b/.test(t) || /\bvice president\b/.test(t)) {
    return CONFIG.seniorityWeights.vp;
  }

  // Director / Head of
  if (/\bdirector\b/.test(t) || /\bhead of\b/.test(t)) {
    return CONFIG.seniorityWeights.director;
  }

  // Manager tier (incl. Sr. Manager / Senior Manager)
  if (/\bmanager\b/.test(t)) {
    return CONFIG.seniorityWeights.manager;
  }

  return CONFIG.seniorityWeights.other;
}

// ---------------------------------------------------------------------------
// Step 2 — opportunity size weight
// ---------------------------------------------------------------------------
export function opportunityWeight(size: string | null | undefined): number {
  const key = (size ?? "Unknown").trim();
  const weight = CONFIG.opportunityWeights[key];
  // Unrecognised labels are treated as "not yet asked", i.e. Unknown.
  return weight === undefined ? CONFIG.opportunityWeights["Unknown"]! : weight;
}

// ---------------------------------------------------------------------------
// Step 3 — adjusted rating
// ---------------------------------------------------------------------------
export function adjustedRating(
  starRating: number | null | undefined,
  credibilityMultiplier: number,
): { adjusted: number; usedPlaceholder: boolean; base: number } {
  const usedPlaceholder = starRating === null || starRating === undefined;
  const base = usedPlaceholder ? CONFIG.emailRatingPlaceholder : Number(starRating);
  return { adjusted: base * credibilityMultiplier, usedPlaceholder, base };
}

// ---------------------------------------------------------------------------
// Step 6 — ICP multiplier
// ---------------------------------------------------------------------------
export function icpMultiplier(icpFit: string | null | undefined): {
  multiplier: number;
  missing: boolean;
  fit: string;
} {
  const fit = (icpFit ?? "").trim();
  if (!fit || fit === "Unknown") {
    return { multiplier: CONFIG.icpNeutralMultiplier, missing: true, fit: fit || "Unknown" };
  }
  const multiplier = CONFIG.icpMultipliers[fit];
  if (multiplier === undefined) {
    return { multiplier: CONFIG.icpNeutralMultiplier, missing: true, fit };
  }
  return { multiplier, missing: false, fit };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** Rounds to 4 decimals so stored scores are stable and readable. */
function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Steps 4-8 — the run
// ---------------------------------------------------------------------------
export interface ScoringInput {
  companies: ScoringCompany[];
  contacts: ScoringContact[];
  crms: ScoringCrm[];
  touchpoints: ScoringTouchpoint[];
  /** Explicit "today" so the run is reproducible. */
  now: Date;
  /** Companies previously classified Lost stay Lost — never auto-assigned. */
  manualLost?: Set<string>;
}

export function runScoring(input: ScoringInput): CompanyScore[] {
  const { companies, contacts, crms, touchpoints, now } = input;
  const manualLost = input.manualLost ?? new Set<string>();

  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const crmById = new Map(crms.map((c) => [c.id, c]));

  // ---- Steps 1-4: per-touchpoint scores, grouped by company ----------------
  const perCompany = new Map<string, TouchpointBreakdown[]>();
  for (const company of companies) perCompany.set(company.id, []);

  for (const tp of touchpoints) {
    if (!perCompany.has(tp.company_id)) continue; // orphan guard

    const contact = tp.contact_id ? contactById.get(tp.contact_id) : undefined;
    const sWeight = seniorityWeight(contact?.title);
    const oWeight = opportunityWeight(tp.est_opportunity_size);

    const crm = tp.crm_id ? crmById.get(tp.crm_id) : undefined;
    const multiplier = crm
      ? Number(crm.credibility_multiplier)
      : CONFIG.defaultCredibilityMultiplier;

    const { adjusted: rawAdjusted, usedPlaceholder } = adjustedRating(tp.star_rating, multiplier);
    // Call ratings come from Granola transcripts rather than a typed rating.
    const noteWeight = tp.type === "Call" ? CONFIG.granolaNoteWeight : 1;
    const adjusted = rawAdjusted * noteWeight;

    perCompany.get(tp.company_id)!.push({
      touchpoint_id: tp.id,
      type: tp.type,
      occurred_at: tp.occurred_at,
      contact_title: contact?.title ?? null,
      seniority_weight: sWeight,
      opportunity_size: (tp.est_opportunity_size ?? "Unknown").trim() || "Unknown",
      opportunity_weight: oWeight,
      star_rating: tp.star_rating ?? null,
      used_email_placeholder: usedPlaceholder,
      credibility_multiplier: multiplier,
      adjusted_rating: round(adjusted),
      score: round(sWeight * oWeight * adjusted),

    });
  }

  // ---- Steps 5-7: rollup, ICP multiplier, exclusions -----------------------
  interface Interim extends Omit<CompanyScore, "rank" | "classified_state" | "reason" | "score_breakdown"> {
    breakdownTouchpoints: TouchpointBreakdown[];
  }

  const interim: Interim[] = companies.map((company) => {
    const tps = perCompany.get(company.id)!;
    // Step 5 — SUM, deliberately not average: volume of engagement counts.
    const rollup = round(tps.reduce((sum, t) => sum + t.score, 0));

    const icp = icpMultiplier(company.icp_fit);
    const finalScore = round(rollup * icp.multiplier);

    const lastAt = tps.reduce<string | null>(
      (latest, t) => (latest === null || t.occurred_at > latest ? t.occurred_at : latest),
      null,
    );
    const daysSince = lastAt === null ? null : daysBetween(new Date(lastAt), now);

    // Step 7 — exclusions (rows are kept, just flagged).
    const reasons: string[] = [];
    if (!company.is_active) reasons.push("Marked inactive");
    if (daysSince === null) {
      reasons.push("No touchpoints recorded");
    } else if (daysSince >= CONFIG.staleAfterDays) {
      reasons.push(`Last touchpoint ${daysSince} days ago (${CONFIG.staleAfterDays}+ day threshold)`);
    }

    return {
      company_id: company.id,
      company_name: company.name,
      raw_score: rollup,
      icp_fit: icp.fit,
      icp_multiplier: icp.multiplier,
      icp_missing: icp.missing,
      final_score: finalScore,
      excluded: reasons.length > 0,
      exclusion_reasons: reasons,
      touchpoint_count: tps.length,
      last_touchpoint_at: lastAt,
      days_since_last_touchpoint: daysSince,
      has_recent_touchpoint:
        daysSince !== null && daysSince < CONFIG.recentTouchpointDays,
      breakdownTouchpoints: tps,
    };
  });

  // ---- Ranking: only non-excluded companies compete for ranks --------------
  const ranked = interim
    .filter((c) => !c.excluded)
    // Deterministic tie-break: score desc, then name, then id.
    .sort(
      (a, b) =>
        b.final_score - a.final_score ||
        a.company_name.localeCompare(b.company_name) ||
        a.company_id.localeCompare(b.company_id),
    );
  const rankByCompany = new Map(ranked.map((c, i) => [c.company_id, i + 1]));

  // ---- Step 8: classification ---------------------------------------------
  return interim.map((c) => {
    const rank = rankByCompany.get(c.company_id) ?? null;

    let state: CompanyState | null;
    let reason: string;

    if (c.excluded) {
      state = null;
      reason = `Excluded from ranking: ${c.exclusion_reasons.join("; ")}.`;
    } else if (manualLost.has(c.company_id)) {
      // "Lost" is never assigned by the engine — it is preserved if set manually.
      state = "Lost";
      reason = "Manually marked Lost; scoring run left the state unchanged.";
    } else if (rank !== null && rank <= CONFIG.topRankCutoff && c.has_recent_touchpoint) {
      state = "Pipeline";
      reason = `Ranked #${rank} of ${ranked.length} by score (${c.final_score}) and last contacted ${c.days_since_last_touchpoint} day(s) ago, inside the ${CONFIG.recentTouchpointDays}-day active window.`;
    } else if (rank !== null && rank <= CONFIG.topRankCutoff) {
      state = "Opportunity";
      reason = `Ranked #${rank} of ${ranked.length} by score (${c.final_score}) but the last touchpoint was ${c.days_since_last_touchpoint} day(s) ago — outside the ${CONFIG.recentTouchpointDays}-day window, so it needs re-engaging.`;
    } else {
      state = "Keep in touch";
      reason = `Ranked #${rank} of ${ranked.length} by score (${c.final_score}), outside the top ${CONFIG.topRankCutoff}, so it stays on the nurture list.`;
    }

    if (c.icp_missing) {
      reason += " ICP fit data is missing, so a neutral 1.0 multiplier was applied (no penalty).";
    }

    const { breakdownTouchpoints, ...rest } = c;

    return {
      ...rest,
      rank,
      classified_state: state,
      reason,
      score_breakdown: {
        config: CONFIG,
        touchpoints: breakdownTouchpoints,
        rollup: c.raw_score,
        icp: { fit: c.icp_fit, multiplier: c.icp_multiplier, missing: c.icp_missing },
        final_score: c.final_score,
        exclusion: { excluded: c.excluded, reasons: c.exclusion_reasons },
        classification: {
          state,
          rank,
          top_cutoff: CONFIG.topRankCutoff,
          has_recent_touchpoint: c.has_recent_touchpoint,
          recent_window_days: CONFIG.recentTouchpointDays,
          reason,
        },
      },
    } satisfies CompanyScore;
  });
}
