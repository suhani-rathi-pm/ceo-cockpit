import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CONFIG, type CompanyState } from "./scoring";

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export interface LeadListRow {
  company_id: string;
  name: string;
  industry: string | null;
  tier_label: string | null;
  rank: number | null;
  final_score: number;
  state: CompanyState | null;
  icp_fit: string;
  icp_missing: boolean;
  days_since_last_touchpoint: number | null;
  owner_crm: string | null;
  touchpoint_count: number;
  news_count: number;
  excluded: boolean;
  exclusion_reasons: string[];
}

export interface LeadsListData {
  run_date: string | null;
  rows: LeadListRow[];
  counts: { total: number; included: number; excluded: number };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Every company in the book — included and excluded — with the columns the
 * Leads table sorts on. Exclusion is never destructive: the row stays, with
 * its reason attached, and the UI decides whether to show it.
 */
export async function getLeadsList(now = new Date()): Promise<LeadsListData> {
  const db = serverClient();

  const latestRun = await db
    .from("score_runs")
    .select("run_date")
    .order("run_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestRun.error) throw new Error(latestRun.error.message);
  const runDate = latestRun.data?.run_date ?? null;

  const [companies, runs, touchpoints, crms, news, history] = await Promise.all([
    db.from("companies").select("id,name,industry,icp_fit,icp_subscores,is_active"),
    runDate
      ? db
          .from("score_runs")
          .select("company_id,final_score,rank,classified_state")
          .eq("run_date", runDate)
      : Promise.resolve({ data: [], error: null } as const),
    db.from("touchpoints").select("company_id,crm_id,occurred_at,star_rating"),
    db.from("crms").select("id,name"),
    db.from("news_items").select("matched_company_id,category,dismissed").eq("dismissed", false),
    db
      .from("state_history")
      .select("company_id,to_state,created_at")
      .order("created_at", { ascending: true }),
  ]);

  for (const res of [companies, runs, touchpoints, crms, news, history]) {
    if (res.error) throw new Error(res.error.message);
  }

  const crmName = new Map((crms.data ?? []).map((c) => [c.id, c.name]));

  const agg = new Map<
    string,
    { count: number; lastAt: string | null; lastCrm: string | null; bestStar: number | null }
  >();
  for (const tp of touchpoints.data ?? []) {
    const cur =
      agg.get(tp.company_id) ?? { count: 0, lastAt: null, lastCrm: null, bestStar: null };
    cur.count += 1;
    if (tp.star_rating !== null && (cur.bestStar === null || tp.star_rating > cur.bestStar)) {
      cur.bestStar = tp.star_rating;
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
    newsByCompany.set(item.matched_company_id, (newsByCompany.get(item.matched_company_id) ?? 0) + 1);
  }

  const runByCompany = new Map((runs.data ?? []).map((r) => [r.company_id, r]));

  // Latest logged state wins over the run's own classification, so manual
  // overrides (including Lost) are what the table filters on.
  const latestState = new Map<string, string>();
  for (const h of history.data ?? []) latestState.set(h.company_id, h.to_state);

  const rows: LeadListRow[] = (companies.data ?? []).map((c) => {
    const a = agg.get(c.id) ?? { count: 0, lastAt: null, lastCrm: null, bestStar: null };
    const run = runByCompany.get(c.id);
    const days =
      a.lastAt === null
        ? null
        : Math.floor((now.getTime() - new Date(a.lastAt).getTime()) / MS_PER_DAY);
    const fit = (c.icp_fit ?? "Unknown").trim() || "Unknown";

    const reasons: string[] = [];
    if (!c.is_active) reasons.push("Marked inactive");
    if (days === null) reasons.push("No touchpoint on record");
    else if (days >= CONFIG.staleAfterDays)
      reasons.push(`No touchpoint in ${days} days (threshold ${CONFIG.staleAfterDays})`);

    return {
      company_id: c.id,
      name: c.name,
      industry: c.industry,
      // 3 stars = VIP, 4 = VVIP, 5 = Top tier; anything lower gets no label.
      tier_label:
        a.bestStar === null
          ? null
          : a.bestStar >= 5
            ? "Top tier"
            : a.bestStar === 4
              ? "VVIP"
              : a.bestStar === 3
                ? "VIP"
                : null,
      rank: run?.rank ?? null,
      final_score: run ? Number(run.final_score) : 0,
      state: (latestState.get(c.id) ?? run?.classified_state ?? null) as CompanyState | null,
      icp_fit: fit,
      icp_missing: fit === "Unknown" || c.icp_subscores == null,
      days_since_last_touchpoint: days,
      owner_crm: a.lastCrm,
      touchpoint_count: a.count,
      news_count: newsByCompany.get(c.id) ?? 0,
      excluded: reasons.length > 0,
      exclusion_reasons: reasons,
    };
  });

  rows.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || b.final_score - a.final_score);

  return {
    run_date: runDate,
    rows,
    counts: {
      total: rows.length,
      included: rows.filter((r) => !r.excluded).length,
      excluded: rows.filter((r) => r.excluded).length,
    },
  };
}
