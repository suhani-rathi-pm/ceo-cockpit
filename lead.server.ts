import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildRecommendation, type Recommendation } from "./recommendation";
import { suggestCollateral, type CollateralItem } from "./collateral.server";
import { listOutreachDrafts, type OutreachDraftRow } from "./outreach.server";
import { summariseSources, type SourceSummary, type SourceTrail } from "./sources";
import type { CompanyScore, CompanyState } from "./scoring";

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type ScoreBreakdown = CompanyScore["score_breakdown"];

export interface LeadTouchpoint extends SourceTrail {
  id: string;
  type: string;
  occurred_at: string;
  star_rating: number | null;
  est_opportunity_size: string | null;
  notes: string | null;
  misc_comments: string | null;
  contact_name: string | null;
  contact_title: string | null;
  crm_name: string | null;
}

export interface LeadNews {
  id: string;
  headline: string;
  source_name: string;
  source_url: string;
  published_at: string;
  relevance_score: number;
  why_it_matters: string | null;
}

export interface LeadHistory {
  id: string;
  from_state: string | null;
  to_state: string;
  actor: string;
  reason: string | null;
  created_at: string;
}

export interface LeadDetail {
  company: {
    id: string;
    name: string;
    industry: string | null;
    headcount_band: string | null;
    icp_fit: string | null;
    is_active: boolean;
  };
  run: {
    run_date: string;
    rank: number | null;
    raw_score: number;
    final_score: number;
    state: CompanyState | null;
    breakdown: ScoreBreakdown | null;
  } | null;
  touchpoints: LeadTouchpoint[];
  news: LeadNews[];
  history: LeadHistory[];
  owner: string | null;
  recommendation: Recommendation;
  chief_of_staff: string;
  /** Where the touchpoints came from, so the score can be traced to a system. */
  sources: SourceSummary;
  collateral: CollateralItem[];
  outreach: OutreachDraftRow[];
}

export async function getLeadDetail(companyId: string): Promise<LeadDetail | null> {
  const db = serverClient();

  const company = await db
    .from("companies")
    .select("id,name,industry,headcount_band,icp_fit,is_active")
    .eq("id", companyId)
    .maybeSingle();
  if (company.error) throw new Error(company.error.message);
  if (!company.data) return null;

  const [run, touchpoints, contacts, crms, news, history, cos] = await Promise.all([
    db
      .from("score_runs")
      .select("run_date,rank,raw_score,final_score,classified_state,score_breakdown")
      .eq("company_id", companyId)
      .order("run_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("touchpoints")
      .select(
        "id,type,occurred_at,star_rating,est_opportunity_size,notes,misc_comments,contact_id,crm_id,source_system,source_ref,source_captured_at,extraction_confidence,source_excerpt",
      )
      .eq("company_id", companyId)
      .order("occurred_at", { ascending: false }),
    db.from("contacts").select("id,full_name,title").eq("company_id", companyId),
    db.from("crms").select("id,name"),
    db
      .from("news_items")
      .select("id,headline,source_name,source_url,published_at,relevance_score,why_it_matters")
      .eq("matched_company_id", companyId)
      .eq("dismissed", false)
      .order("relevance_score", { ascending: false }),
    db
      .from("state_history")
      .select("id,from_state,to_state,actor,reason,created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    db.from("app_settings").select("value").eq("key", "chief_of_staff_email").maybeSingle(),
  ]);

  for (const res of [run, touchpoints, contacts, crms, news, history, cos]) {
    if (res.error) throw new Error(res.error.message);
  }

  const contactById = new Map((contacts.data ?? []).map((c) => [c.id, c]));
  const crmById = new Map((crms.data ?? []).map((c) => [c.id, c.name]));

  const tps = touchpoints.data ?? [];
  const latest = tps[0] ?? null; // already ordered newest first
  const owner = latest?.crm_id ? crmById.get(latest.crm_id) ?? null : null;
  const daysSince = latest
    ? Math.floor((Date.now() - new Date(latest.occurred_at).getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const newsRows = (news.data ?? []).map((n) => ({
    ...n,
    relevance_score: Number(n.relevance_score),
  }));
  const chiefOfStaff = (cos.data?.value as string | undefined) ?? "chief.of.staff@programming.com";

  const [collateral, outreach] = await Promise.all([
    suggestCollateral(company.data.industry),
    listOutreachDrafts(companyId),
  ]);

  /**
   * The "Recommended next move" card. Deterministic — built from the same run
   * data the score came from, so the answer never contradicts the working.
   */
  const recommendation = buildRecommendation({
    name: company.data.name,
    state: (run.data?.classified_state as CompanyState | null) ?? null,
    rank: run.data?.rank ?? null,
    finalScore: Number(run.data?.final_score ?? 0),
    icpFit: company.data.icp_fit ?? "Unknown",
    icpMissing: !company.data.icp_fit || company.data.icp_fit === "Unknown",
    isActive: company.data.is_active,
    daysSinceLastTouch: daysSince,
    owner,
    touchpointCount: tps.length,
    latest: latest
      ? {
          type: latest.type,
          occurredAt: latest.occurred_at,
          contactName: latest.contact_id
            ? contactById.get(latest.contact_id)?.full_name ?? null
            : null,
          contactTitle: latest.contact_id
            ? contactById.get(latest.contact_id)?.title ?? null
            : null,
          oppSize: latest.est_opportunity_size,
        }
      : null,
    topNews: newsRows[0]
      ? {
          headline: newsRows[0].headline,
          source: newsRows[0].source_name,
          publishedAt: newsRows[0].published_at,
        }
      : null,
    chiefOfStaff,
  });

  return {
    company: company.data,
    run: run.data
      ? {
          run_date: run.data.run_date,
          rank: run.data.rank,
          raw_score: Number(run.data.raw_score),
          final_score: Number(run.data.final_score),
          state: run.data.classified_state as CompanyState | null,
          breakdown: (run.data.score_breakdown as unknown as ScoreBreakdown) ?? null,
        }
      : null,
    touchpoints: (touchpoints.data ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      occurred_at: t.occurred_at,
      star_rating: t.star_rating,
      est_opportunity_size: t.est_opportunity_size,
      notes: t.notes,
      misc_comments: t.misc_comments,
      contact_name: t.contact_id ? contactById.get(t.contact_id)?.full_name ?? null : null,
      contact_title: t.contact_id ? contactById.get(t.contact_id)?.title ?? null : null,
      crm_name: t.crm_id ? crmById.get(t.crm_id) ?? null : null,
      source_system: t.source_system,
      source_ref: t.source_ref,
      source_captured_at: t.source_captured_at,
      extraction_confidence:
        t.extraction_confidence === null ? null : Number(t.extraction_confidence),
      source_excerpt: t.source_excerpt,
    })),
    news: newsRows,
    history: history.data ?? [],
    owner,
    recommendation,
    chief_of_staff: chiefOfStaff,
    sources: summariseSources(
      tps.map((t) => ({
        source_system: t.source_system,
        source_ref: t.source_ref,
        source_captured_at: t.source_captured_at,
        extraction_confidence:
          t.extraction_confidence === null ? null : Number(t.extraction_confidence),
        source_excerpt: t.source_excerpt,
      })),
    ),
    collateral,
    outreach,
  };
}

/** Human override of the system classification — logged, never silently applied. */
export async function correctLeadClassification(input: {
  companyId: string;
  toState: CompanyState;
  actor: string;
  reason: string;
}): Promise<{ ok: true }> {
  const db = serverClient();

  const [latest, run] = await Promise.all([
    db
      .from("state_history")
      .select("to_state")
      .eq("company_id", input.companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("score_runs")
      .select("classified_state")
      .eq("company_id", input.companyId)
      .order("run_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (latest.error) throw new Error(latest.error.message);
  if (run.error) throw new Error(run.error.message);

  const from = latest.data?.to_state ?? null;
  // predicted_state is the system's own last prediction and is never overwritten;
  // corrected_state records what the human decided instead.
  const predicted = run.data?.classified_state ?? from;
  const res = await db.from("state_history").insert({
    company_id: input.companyId,
    from_state: from,
    to_state: input.toState,
    actor: input.actor,
    reason: input.reason,
    predicted_state: predicted,
    corrected_state: input.toState,
  });
  if (res.error) throw new Error(res.error.message);
  return { ok: true };
}

/** Routes a company to a business unit for follow-up. */
export async function createLeadAction(input: {
  companyId: string;
  routedTo: string;
  note: string;
}): Promise<{ ok: true }> {
  const db = serverClient();
  const res = await db.from("actions").insert({
    company_id: input.companyId,
    routed_to_unit: input.routedTo,
    status: "Open",
    note: input.note,
  });
  if (res.error) throw new Error(res.error.message);
  return { ok: true };
}
