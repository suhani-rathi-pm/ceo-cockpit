import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export { NEWS_CONFIG } from "./news.constants";
import { NEWS_CONFIG } from "./news.constants";

export interface NewsItemRow {
  id: string;
  headline: string;
  source_name: string;
  source_url: string;
  published_at: string;
  relevance_score: number;
  why_it_matters: string | null;
  category: string;
  company: {
    id: string;
    name: string;
    state: string | null;
    days_since_last_touch: number | null;
    touchpoint_count: number;
    owner: string | null;
  } | null;
}

export interface NewsData {
  stats: {
    ingested: number;
    matched: number;
    passed: number;
    shown: number;
    min_relevance: number;
    below_threshold: number;
    dismissed: number;
  };
  tuning: NewsTuning;
  account_linked: NewsItemRow[];
  market_sector: NewsItemRow[];
}

export async function getNewsData(): Promise<NewsData> {
  const db = serverClient();
  const { loadNewsParams } = await import("./params.server");
  const { minRelevance, maxItems } = await loadNewsParams();



  const [items, companies, latestRun, touchpoints, crms] = await Promise.all([
    db
      .from("news_items")
      .select(
        "id,headline,source_name,source_url,published_at,relevance_score,why_it_matters,category,matched_company_id,dismissed",
      )
      .order("relevance_score", { ascending: false }),
    db.from("companies").select("id,name"),
    db
      .from("score_runs")
      .select("run_date")
      .order("run_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("touchpoints").select("company_id,crm_id,occurred_at"),
    db.from("crms").select("id,name"),
  ]);

  for (const res of [items, companies, latestRun, touchpoints, crms]) {
    if (res.error) throw new Error(res.error.message);
  }

  const runDate = latestRun.data?.run_date ?? null;
  const stateByCompany = new Map<string, string | null>();
  if (runDate) {
    const runs = await db
      .from("score_runs")
      .select("company_id,classified_state")
      .eq("run_date", runDate);
    if (runs.error) throw new Error(runs.error.message);
    for (const r of runs.data ?? []) stateByCompany.set(r.company_id, r.classified_state);
  }

  const nameById = new Map((companies.data ?? []).map((c) => [c.id, c.name]));

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const crmName = new Map((crms.data ?? []).map((c) => [c.id, c.name]));
  const agg = new Map<string, { count: number; lastAt: string | null; owner: string | null }>();
  for (const tp of touchpoints.data ?? []) {
    const cur = agg.get(tp.company_id) ?? { count: 0, lastAt: null, owner: null };
    cur.count += 1;
    if (cur.lastAt === null || tp.occurred_at > cur.lastAt) {
      cur.lastAt = tp.occurred_at;
      cur.owner = tp.crm_id ? crmName.get(tp.crm_id) ?? null : null;
    }
    agg.set(tp.company_id, cur);
  }
  const now = Date.now();

  /**
   * "Why it matters" is written against our actual position with the account —
   * its state, how long since we spoke and who owns it — rather than a summary
   * of the article. Deterministic: the same row always reads the same way.
   */
  function whyItMatters(
    seeded: string | null,
    company: { name: string; state: string | null; days: number | null; count: number; owner: string | null } | null,
  ): string {
    const base = (seeded ?? "").trim().replace(/\s+/g, " ");
    const head = base ? (base.endsWith(".") ? base : `${base}.`) : "";
    if (!company) {
      return `${head} Nothing in the current book is matched to this, so it is context rather than an action — it changes what a first conversation in the sector should sound like, not what we do today.`.trim();
    }
    const pos =
      company.state === "Pipeline"
        ? `${company.name} is already in Pipeline with ${company.owner ?? "no owner recorded"} on it`
        : company.state === "Opportunity"
          ? `${company.name} has been sitting in Opportunity on timing alone`
          : company.state === "Lost"
            ? `${company.name} is currently marked Lost`
            : `${company.name} is in Keep in touch and not competing for attention this week`;
    const recency =
      company.days === null
        ? "we have no dated contact on file"
        : `our last contact was ${company.days} ${company.days === 1 ? "day" : "days"} ago across ${company.count} recorded touchpoints`;
    const consequence =
      company.state === "Pipeline"
        ? "It gives whatever goes back to them this week a reason to be about them rather than about us."
        : company.state === "Opportunity"
          ? "It is the kind of event that removes the timing objection the account has been parked on."
          : "It is a concrete reason to reopen at a more senior level than the last conversation.";
    return `${head} ${pos}, and ${recency}. ${consequence}`.trim();
  }
  const all = items.data ?? [];
  const live = all.filter((i) => !i.dismissed);

  const mapped: NewsItemRow[] = live
    .filter((i) => Number(i.relevance_score) >= minRelevance)
    .map((i) => ({
      id: i.id,
      headline: i.headline,
      source_name: i.source_name,
      source_url: i.source_url,
      published_at: i.published_at,
      relevance_score: Number(i.relevance_score),
      why_it_matters: whyItMatters(
        i.why_it_matters,
        i.matched_company_id && nameById.has(i.matched_company_id)
          ? {
              name: nameById.get(i.matched_company_id)!,
              state: stateByCompany.get(i.matched_company_id) ?? null,
              days: (() => {
                const a = agg.get(i.matched_company_id!);
                return a?.lastAt
                  ? Math.floor((now - new Date(a.lastAt).getTime()) / MS_PER_DAY)
                  : null;
              })(),
              count: agg.get(i.matched_company_id)?.count ?? 0,
              owner: agg.get(i.matched_company_id)?.owner ?? null,
            }
          : null,
      ),
      category: i.category,
      company:
        i.matched_company_id && nameById.has(i.matched_company_id)
          ? {
              id: i.matched_company_id,
              name: nameById.get(i.matched_company_id)!,
              state: stateByCompany.get(i.matched_company_id) ?? null,
              days_since_last_touch: (() => {
                const a = agg.get(i.matched_company_id!);
                return a?.lastAt
                  ? Math.floor((now - new Date(a.lastAt).getTime()) / MS_PER_DAY)
                  : null;
              })(),
              touchpoint_count: agg.get(i.matched_company_id)?.count ?? 0,
              owner: agg.get(i.matched_company_id)?.owner ?? null,
            }
          : null,
    }))
    .sort((a, b) => b.relevance_score - a.relevance_score);

  const accountLinked = mapped.filter((i) => i.company !== null);
  const marketSector = mapped.filter((i) => i.company === null);

  const dismissedRows = all.filter((i) => i.dismissed);

  return {
    stats: {
      ingested: NEWS_CONFIG.upstreamIngested,
      matched: all.length,
      passed: mapped.length,
      shown: Math.min(mapped.length, maxItems),
      min_relevance: minRelevance,
      below_threshold: live.filter((i) => Number(i.relevance_score) < minRelevance).length,
      dismissed: dismissedRows.length,
    },
    tuning: await buildTuning(db, minRelevance),
    account_linked: accountLinked,
    market_sector: marketSector,
  };
}

export interface NewsTuning {
  min_relevance: number;
  dismissals: number;
  recent: { headline: string; reason: string; relevance_score: number | null; created_at: string }[];
  by_reason: { reason: string; count: number }[];
  /** A threshold that would have filtered out most of what was dismissed. */
  suggested_min_relevance: number | null;
  suggestion: string | null;
}

async function buildTuning(
  db: ReturnType<typeof serverClient>,
  minRelevance: number,
): Promise<NewsTuning> {
  const res = await db
    .from("news_dismissals")
    .select("headline,reason,relevance_score,created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (res.error) throw new Error(res.error.message);
  const rows = res.data ?? [];

  const byReason = new Map<string, number>();
  for (const r of rows) byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + 1);

  // Only "not material" dismissals are evidence about the threshold — a wrong
  // company is an entity-resolution problem and a duplicate is a de-dup one.
  const material = rows
    .filter((r) => r.reason === "Not material" && r.relevance_score !== null)
    .map((r) => Number(r.relevance_score));

  let suggested: number | null = null;
  let suggestion: string | null = null;
  if (material.length >= 3) {
    const highest = Math.max(...material);
    const candidate = Math.min(0.95, Math.round((highest + 0.01) * 100) / 100);
    if (candidate > minRelevance) {
      suggested = candidate;
      const below = material.filter((s) => s < candidate).length;
      suggestion = `${below} of your last ${material.length} "not material" dismissals scored below ${candidate.toFixed(2)}. Raising the floor from ${minRelevance.toFixed(2)} to ${candidate.toFixed(2)} would have kept them out of the briefing.`;
    } else {
      suggestion = `The floor at ${minRelevance.toFixed(2)} already sits above everything you have dismissed as immaterial. Nothing to change.`;
    }
  } else {
    suggestion =
      material.length === 0
        ? null
        : `${material.length} immaterial dismissal${material.length === 1 ? "" : "s"} on record. Three are needed before a threshold change is worth making.`;
  }

  return {
    min_relevance: minRelevance,
    dismissals: rows.length,
    recent: rows.slice(0, 6).map((r) => ({
      headline: r.headline,
      reason: r.reason,
      relevance_score: r.relevance_score === null ? null : Number(r.relevance_score),
      created_at: r.created_at,
    })),
    by_reason: [...byReason.entries()].map(([reason, count]) => ({ reason, count })),
    suggested_min_relevance: suggested,
    suggestion,
  };
}

export async function dismissNews(id: string, reason: string): Promise<{ ok: true }> {
  const db = serverClient();

  const item = await db
    .from("news_items")
    .select("headline,relevance_score")
    .eq("id", id)
    .maybeSingle();
  if (item.error) throw new Error(item.error.message);

  const res = await db.from("news_items").update({ dismissed: true }).eq("id", id);
  if (res.error) throw new Error(res.error.message);

  // The dismissal is the tuning signal, so it is kept rather than just hidden.
  const log = await db.from("news_dismissals").insert({
    news_item_id: id,
    headline: item.data?.headline ?? "",
    reason,
    relevance_score: item.data?.relevance_score ?? null,
    actor: "CEO",
  });
  if (log.error) throw new Error(log.error.message);

  return { ok: true };
}

/** Applies a new relevance floor from the News page tuning card. */
export async function setMinRelevance(value: number): Promise<{ min_relevance: number }> {
  const { saveParams } = await import("./params.server");
  const params = await saveParams({ "news.minRelevance": value });
  return { min_relevance: params["news.minRelevance"]! };
}

