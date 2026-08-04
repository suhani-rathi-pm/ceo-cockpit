import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CompanyState } from "./scoring";
import { buildBriefing, type Briefing } from "./briefing";
import { NEWS_CONFIG } from "./news.constants";

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type TierLabel = "Top tier" | "VVIP" | "VIP" | null;

export interface DashboardRow {
  company_id: string;
  name: string;
  rank: number | null;
  final_score: number;
  raw_score: number;
  state: CompanyState;
  best_star_rating: number | null;
  tier_label: TierLabel;
  days_since_last_touchpoint: number | null;
  owner_crm: string | null;
  news_count: number;
  icp_fit: string;
  icp_missing: boolean;
  industry: string | null;
  touchpoint_count: number;
}

export interface DashboardData {
  run_date: string | null;
  briefing: Briefing;
  summary: { pipeline: number; moved_since_yesterday: number; news_items: number };
  pipeline: DashboardRow[];
  opportunity: DashboardRow[];
  keep_in_touch: DashboardRow[];
  needs_review: DashboardRow[];
}

/** 3 stars = VIP, 4 = VVIP, 5 = Top tier. Below 3 (or no rating) gets no label. */
function tierLabel(best: number | null): TierLabel {
  if (best === null) return null;
  if (best >= 5) return "Top tier";
  if (best === 4) return "VVIP";
  if (best === 3) return "VIP";
  return null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function getDashboardData(now = new Date()): Promise<DashboardData> {
  const db = serverClient();

  const latestRun = await db
    .from("score_runs")
    .select("run_date")
    .order("run_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestRun.error) throw new Error(latestRun.error.message);

  const runDate = latestRun.data?.run_date ?? null;
  if (!runDate) {
    return {
      run_date: null,
      briefing: buildBriefing({
        runDate: null,
        generatedAt: "04:31",
        pipeline: [],
        opportunity: [],
        keepInTouch: [],
        needsReview: [],
        news: [],
        moves: [],
        newsIngested: NEWS_CONFIG.upstreamIngested,
        newsKept: 0,
      }),
      summary: { pipeline: 0, moved_since_yesterday: 0, news_items: 0 },
      pipeline: [],
      opportunity: [],
      keep_in_touch: [],
      needs_review: [],
    };
  }

  const [runs, companies, touchpoints, crms, news, history] = await Promise.all([
    db
      .from("score_runs")
      .select("company_id,raw_score,final_score,rank,classified_state")
      .eq("run_date", runDate),
    db.from("companies").select("id,name,industry,icp_fit,icp_subscores"),
    db.from("touchpoints").select("company_id,crm_id,star_rating,occurred_at"),
    db.from("crms").select("id,name"),
    db
      .from("news_items")
      .select(
        "matched_company_id,category,dismissed,headline,source_name,published_at,relevance_score",
      )
      .eq("dismissed", false)
      .order("relevance_score", { ascending: false }),
    db.from("state_history").select("company_id,from_state,to_state,created_at,actor"),
  ]);

  for (const res of [runs, companies, touchpoints, crms, news, history]) {
    if (res.error) throw new Error(res.error.message);
  }

  const crmName = new Map((crms.data ?? []).map((c) => [c.id, c.name]));

  // Per-company touchpoint aggregates: best star rating, last touch, owning CRM.
  const agg = new Map<
    string,
    { best: number | null; lastAt: string | null; lastCrm: string | null; count: number }
  >();
  for (const tp of touchpoints.data ?? []) {
    const cur =
      agg.get(tp.company_id) ?? { best: null, lastAt: null, lastCrm: null, count: 0 };
    cur.count += 1;
    if (tp.star_rating !== null && (cur.best === null || tp.star_rating > cur.best)) {
      cur.best = tp.star_rating;
    }
    if (cur.lastAt === null || tp.occurred_at > cur.lastAt) {
      cur.lastAt = tp.occurred_at;
      cur.lastCrm = tp.crm_id ? crmName.get(tp.crm_id) ?? null : null;
    }
    agg.set(tp.company_id, cur);
  }

  const newsByCompany = new Map<string, number>();
  for (const item of news.data ?? []) {
    if (item.category !== "account_linked" || !item.matched_company_id) continue;
    newsByCompany.set(
      item.matched_company_id,
      (newsByCompany.get(item.matched_company_id) ?? 0) + 1,
    );
  }

  const companyById = new Map((companies.data ?? []).map((c) => [c.id, c]));

  const rows: DashboardRow[] = (runs.data ?? [])
    .filter((r) => r.classified_state !== null)
    .map((r) => {
      const company = companyById.get(r.company_id);
      const a = agg.get(r.company_id) ?? { best: null, lastAt: null, lastCrm: null, count: 0 };
      const fit = (company?.icp_fit ?? "Unknown").trim() || "Unknown";
      return {
        company_id: r.company_id,
        name: company?.name ?? "Unknown company",
        rank: r.rank,
        final_score: Number(r.final_score),
        raw_score: Number(r.raw_score),
        state: r.classified_state as CompanyState,
        best_star_rating: a.best,
        tier_label: tierLabel(a.best),
        days_since_last_touchpoint:
          a.lastAt === null
            ? null
            : Math.floor((now.getTime() - new Date(a.lastAt).getTime()) / MS_PER_DAY),
        owner_crm: a.lastCrm,
        news_count: newsByCompany.get(r.company_id) ?? 0,
        icp_fit: fit,
        icp_missing: fit === "Unknown" || company?.icp_subscores == null,
        industry: company?.industry ?? null,
        touchpoint_count: a.count,
      };
    })
    .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || b.final_score - a.final_score);

  const byState = (state: CompanyState) => rows.filter((r) => r.state === state);

  // "Moved since yesterday" = system/human state changes logged in the last 24h.
  const cutoff = now.getTime() - MS_PER_DAY;
  const moved = (history.data ?? []).filter(
    (h) =>
      h.from_state !== null &&
      h.from_state !== h.to_state &&
      new Date(h.created_at).getTime() >= cutoff,
  ).length;

  const pipeline = byState("Pipeline");
  const opportunity = byState("Opportunity");
  const keepInTouch = byState("Keep in touch");
  const needsReview = rows.filter((r) => r.icp_missing);

  const nameById2 = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
  const { loadNewsParams } = await import("./params.server");
  const { minRelevance } = await loadNewsParams();
  const keptNews = (news.data ?? []).filter(
    (n) => Number(n.relevance_score) >= minRelevance,
  );
  const briefingNews = keptNews
    .filter((n) => n.category === "account_linked" && n.matched_company_id)
    .map((n) => ({
      company_name: nameById2.get(n.matched_company_id!) ?? null,
      headline: n.headline,
      source_name: n.source_name,
      published_at: n.published_at,
    }));

  const recentMoves = (history.data ?? [])
    .filter(
      (h) =>
        h.from_state !== null &&
        h.from_state !== h.to_state &&
        new Date(h.created_at).getTime() >= now.getTime() - 3 * MS_PER_DAY,
    )
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((h) => ({
      company_name: nameById2.get(h.company_id) ?? "An account",
      from_state: h.from_state,
      to_state: h.to_state,
      actor: h.actor,
    }));

  const briefing = buildBriefing({
    runDate,
    generatedAt: "04:31",
    pipeline,
    opportunity,
    keepInTouch,
    needsReview,
    news: briefingNews,
    moves: recentMoves,
    newsIngested: NEWS_CONFIG.upstreamIngested,
    newsKept: keptNews.length,
  });

  return {
    run_date: runDate,
    briefing,
    summary: {
      pipeline: pipeline.length,
      moved_since_yesterday: moved,
      news_items: (news.data ?? []).length,
    },
    pipeline,
    opportunity,
    keep_in_touch: keepInTouch,
    needs_review: needsReview,
  };
}
