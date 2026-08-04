import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CompanyState } from "./scoring";
import { buildCrmBriefing, type CrmBriefing } from "./crm-briefing";

/**
 * The account owner's side of the product. Same data, different question:
 * not "who needs the CEO" but "what is mine, what is drifting, and what has
 * the CEO asked me for".
 */

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const GOING_COLD_DAYS = 14;

export interface CrmAccountRow {
  company_id: string;
  name: string;
  industry: string | null;
  rank: number | null;
  state: CompanyState;
  tier_label: string | null;
  days_since_last_touchpoint: number | null;
  touchpoint_count: number;
  icp_fit: string;
  icp_missing: boolean;
  owner_crm: string | null;
}

export interface CrmReply {
  id: string;
  author: string;
  body: string;
  created_at: string;
}

export interface CrmMessage {
  id: string;
  company_id: string;
  company_name: string;
  state: CompanyState | null;
  body: string;
  read: boolean;
  created_at: string;
  replies: CrmReply[];
}

export interface PendingRow {
  id: string;
  company_id: string | null;
  company_name: string;
  type: string;
  contact_name: string;
  contact_title: string;
  occurred_on: string;
  est_opportunity_size: string;
  star_rating: number | null;
  notes: string;
  misc_comments: string | null;
  created_at: string;
}

export interface CrmDashboardData {
  crm_name: string;
  run_date: string | null;
  counters: {
    accounts: number;
    unread: number;
    open_with_me: number;
    going_cold: number;
  };
  briefing: CrmBriefing;
  unread_messages: CrmMessage[];
  pending: PendingRow[];
  pipeline: CrmAccountRow[];
  opportunity: CrmAccountRow[];
  keep_in_touch: CrmAccountRow[];
  cold: CrmAccountRow[];
}

function tierLabel(best: number | null) {
  if (best === null) return null;
  if (best >= 5) return "Top tier";
  if (best === 4) return "VVIP";
  if (best === 3) return "VIP";
  return null;
}

/** Ownership is the CRM on the most recent touchpoint — the same rule the CEO side uses. */
async function loadBook(now: Date) {
  const db = serverClient();

  const latestRun = await db
    .from("score_runs")
    .select("run_date")
    .order("run_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestRun.error) throw new Error(latestRun.error.message);
  const runDate = latestRun.data?.run_date ?? null;

  const [companies, runs, touchpoints, crms] = await Promise.all([
    db.from("companies").select("id,name,industry,icp_fit,icp_subscores,is_active"),
    runDate
      ? db
          .from("score_runs")
          .select("company_id,rank,classified_state")
          .eq("run_date", runDate)
      : Promise.resolve({ data: [], error: null } as const),
    db.from("touchpoints").select("company_id,crm_id,star_rating,occurred_at"),
    db.from("crms").select("id,name"),
  ]);
  for (const res of [companies, runs, touchpoints, crms]) {
    if (res.error) throw new Error(res.error.message);
  }

  const crmName = new Map((crms.data ?? []).map((c) => [c.id, c.name]));
  const agg = new Map<
    string,
    { best: number | null; lastAt: string | null; owner: string | null; count: number }
  >();
  for (const tp of touchpoints.data ?? []) {
    const cur = agg.get(tp.company_id) ?? { best: null, lastAt: null, owner: null, count: 0 };
    cur.count += 1;
    if (tp.star_rating !== null && (cur.best === null || tp.star_rating > cur.best)) {
      cur.best = tp.star_rating;
    }
    if (cur.lastAt === null || tp.occurred_at > cur.lastAt) {
      cur.lastAt = tp.occurred_at;
      cur.owner = tp.crm_id ? crmName.get(tp.crm_id) ?? null : null;
    }
    agg.set(tp.company_id, cur);
  }

  const stateByCompany = new Map(
    (runs.data ?? []).map((r) => [r.company_id, { rank: r.rank, state: r.classified_state }]),
  );

  const rows: CrmAccountRow[] = (companies.data ?? []).map((c) => {
    const a = agg.get(c.id) ?? { best: null, lastAt: null, owner: null, count: 0 };
    const run = stateByCompany.get(c.id);
    const fit = (c.icp_fit ?? "Unknown").trim() || "Unknown";
    return {
      company_id: c.id,
      name: c.name,
      industry: c.industry,
      rank: run?.rank ?? null,
      state: (run?.state as CompanyState) ?? "Keep in touch",
      tier_label: tierLabel(a.best),
      days_since_last_touchpoint:
        a.lastAt === null
          ? null
          : Math.floor((now.getTime() - new Date(a.lastAt).getTime()) / MS_PER_DAY),
      touchpoint_count: a.count,
      icp_fit: fit,
      icp_missing: fit === "Unknown" || c.icp_subscores == null,
      owner_crm: a.owner,
    };
  });

  return { runDate, rows, ownerOf: (id: string) => agg.get(id)?.owner ?? null };
}

async function loadMessages(crmName: string): Promise<CrmMessage[]> {
  const db = serverClient();
  const [messages, companies, runs] = await Promise.all([
    db
      .from("ceo_messages")
      .select("id,company_id,body,read,created_at,crm_name")
      .eq("crm_name", crmName)
      .order("created_at", { ascending: false }),
    db.from("companies").select("id,name"),
    db
      .from("score_runs")
      .select("company_id,classified_state,run_date")
      .order("run_date", { ascending: false }),
  ]);
  for (const res of [messages, companies, runs]) {
    if (res.error) throw new Error(res.error.message);
  }

  const ids = (messages.data ?? []).map((m) => m.id);
  const replies = ids.length
    ? await db
        .from("message_replies")
        .select("id,message_id,author,body,created_at")
        .in("message_id", ids)
        .order("created_at", { ascending: true })
    : ({ data: [], error: null } as const);
  if (replies.error) throw new Error(replies.error.message);

  const nameById = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
  const stateById = new Map<string, string | null>();
  for (const r of runs.data ?? []) {
    if (!stateById.has(r.company_id)) stateById.set(r.company_id, r.classified_state);
  }

  return (messages.data ?? []).map((m) => ({
    id: m.id,
    company_id: m.company_id,
    company_name: nameById.get(m.company_id) ?? "Unknown account",
    state: (stateById.get(m.company_id) as CompanyState) ?? null,
    body: m.body,
    read: m.read,
    created_at: m.created_at,
    replies: (replies.data ?? [])
      .filter((r) => r.message_id === m.id)
      .map((r) => ({ id: r.id, author: r.author, body: r.body, created_at: r.created_at })),
  }));
}

async function loadPending(crmName: string): Promise<PendingRow[]> {
  const db = serverClient();
  const res = await db
    .from("pending_activity")
    .select(
      "id,company_id,company_name,type,contact_name,contact_title,occurred_on,est_opportunity_size,star_rating,notes,misc_comments,created_at",
    )
    .eq("submitted_by", crmName)
    .order("created_at", { ascending: false });
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as PendingRow[];
}

export async function getCrmDashboardData(
  crmName: string,
  now = new Date(),
): Promise<CrmDashboardData> {
  const db = serverClient();
  const { runDate, rows, ownerOf } = await loadBook(now);
  const mine = rows.filter((r) => r.owner_crm === crmName);
  const mineIds = new Set(mine.map((r) => r.company_id));

  const [messages, pending, openActions] = await Promise.all([
    loadMessages(crmName),
    loadPending(crmName),
    db.from("actions").select("id,company_id,status").eq("status", "Open"),
  ]);
  if (openActions.error) throw new Error(openActions.error.message);

  const openWithMe = (openActions.data ?? []).filter((a) => mineIds.has(a.company_id)).length;
  void ownerOf;

  const byState = (s: CompanyState) => mine.filter((r) => r.state === s);
  const pipeline = byState("Pipeline");
  const opportunity = byState("Opportunity");
  const keepInTouch = byState("Keep in touch");
  const cold = mine
    .filter(
      (r) =>
        r.days_since_last_touchpoint === null ||
        r.days_since_last_touchpoint >= GOING_COLD_DAYS,
    )
    .sort((a, b) => (b.days_since_last_touchpoint ?? 0) - (a.days_since_last_touchpoint ?? 0));
  const unread = messages.filter((m) => !m.read);

  const briefing = buildCrmBriefing({
    firstName: crmName.split(" ")[0] ?? crmName,
    runDate,
    generatedAt: "04:31",
    pipeline,
    opportunity,
    keepInTouch,
    cold,
    unreadCount: unread.length,
    pendingCount: pending.length,
    openWithMe,
  });

  return {
    crm_name: crmName,
    run_date: runDate,
    counters: {
      accounts: mine.length,
      unread: unread.length,
      open_with_me: openWithMe,
      going_cold: cold.length,
    },
    briefing,
    unread_messages: unread,
    pending,
    pipeline,
    opportunity,
    keep_in_touch: keepInTouch,
    cold,
  };
}

export async function getCrmMessages(crmName: string): Promise<CrmMessage[]> {
  return await loadMessages(crmName);
}

export async function markMessageRead(messageId: string) {
  const db = serverClient();
  const res = await db.from("ceo_messages").update({ read: true }).eq("id", messageId);
  if (res.error) throw new Error(res.error.message);
  return { ok: true as const };
}

export async function replyToMessage(input: {
  messageId: string;
  author: string;
  body: string;
}) {
  const db = serverClient();
  const insert = await db.from("message_replies").insert({
    message_id: input.messageId,
    author: input.author,
    body: input.body,
  });
  if (insert.error) throw new Error(insert.error.message);
  await markMessageRead(input.messageId);
  return { ok: true as const };
}

export interface AccountOption {
  company_id: string;
  name: string;
  mine: boolean;
}

/** Accounts the owner can log against — theirs first, then the rest of the book. */
export async function getAccountOptions(
  crmName: string,
  now = new Date(),
): Promise<AccountOption[]> {
  const { rows } = await loadBook(now);
  return rows
    .map((r) => ({ company_id: r.company_id, name: r.name, mine: r.owner_crm === crmName }))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name));
}

export interface ActivitySubmission {
  companyId: string | null;
  newCompanyName?: string;
  newCompanyIndustry?: string;
  submittedBy: string;
  type: string;
  contactName: string;
  contactTitle: string;
  occurredOn: string;
  estOpportunitySize: string;
  starRating: number | null;
  notes: string;
  miscComments: string;
}

/**
 * A logged touchpoint does not enter scoring immediately. It lands in
 * pending_activity and is picked up by the 04:30 run.
 */
export async function submitActivity(input: ActivitySubmission) {
  const db = serverClient();
  let companyId = input.companyId;
  let companyName = "";

  if (!companyId) {
    const name = (input.newCompanyName ?? "").trim();
    if (!name) throw new Error("Give the new account a name.");
    const created = await db
      .from("companies")
      .insert({
        name,
        industry: (input.newCompanyIndustry ?? "").trim() || "Unclassified",
        headcount_band: "Unknown",
        icp_fit: "Unknown",
      })
      .select("id,name")
      .single();
    if (created.error) throw new Error(created.error.message);
    companyId = created.data.id;
    companyName = created.data.name;
  } else {
    const found = await db.from("companies").select("name").eq("id", companyId).single();
    if (found.error) throw new Error(found.error.message);
    companyName = found.data.name;
  }

  const res = await db.from("pending_activity").insert({
    company_id: companyId,
    company_name: companyName,
    submitted_by: input.submittedBy,
    type: input.type,
    contact_name: input.contactName.trim(),
    contact_title: input.contactTitle.trim(),
    occurred_on: input.occurredOn,
    est_opportunity_size: input.estOpportunitySize,
    // Email is never rated — the engine substitutes its own placeholder.
    star_rating: input.type === "Email" ? null : input.starRating,
    notes: input.notes.trim(),
    misc_comments: input.miscComments.trim() || null,
  });
  if (res.error) throw new Error(res.error.message);
  return { ok: true as const, company_name: companyName };
}

/** CRM-side interventions. Each one writes an actions row so it is auditable. */
export type CrmActionType =
  | "revise_opportunity"
  | "flag_for_ceo"
  | "collateral_request"
  | "mark_inactive";

export async function logCrmAction(input: {
  type: CrmActionType;
  companyId: string;
  actor: string;
  unit: string;
  note: string;
  subject?: string | null;
}) {
  const db = serverClient();
  const res = await db.from("actions").insert({
    company_id: input.companyId,
    routed_to_unit: input.unit,
    status: "Open",
    note: input.note,
    type: input.type,
    subject: input.subject ?? null,
  });
  if (res.error) throw new Error(res.error.message);
  return { ok: true as const };
}

export async function reviseOpportunity(input: {
  companyId: string;
  actor: string;
  newSize: string;
  whatChanged: string;
}) {
  if (!input.whatChanged.trim()) throw new Error("Say what changed.");
  return await logCrmAction({
    type: "revise_opportunity",
    companyId: input.companyId,
    actor: input.actor,
    unit: "Sales",
    subject: `Opportunity size → ${input.newSize}`,
    note: `${input.actor} revised the opportunity size to ${input.newSize}. What changed: ${input.whatChanged.trim()}`,
  });
}

export async function flagForCeo(input: {
  companyId: string;
  actor: string;
  body: string;
}) {
  if (!input.body.trim()) throw new Error("Write what Ishwari needs to know.");
  return await logCrmAction({
    type: "flag_for_ceo",
    companyId: input.companyId,
    actor: input.actor,
    unit: "Exec",
    subject: `Flagged by ${input.actor}`,
    note: input.body.trim(),
  });
}

export async function requestCollateral(input: {
  companyId: string;
  actor: string;
  item: string;
  neededBy: string;
  note: string;
}) {
  return await logCrmAction({
    type: "collateral_request",
    companyId: input.companyId,
    actor: input.actor,
    unit: "Delivery",
    subject: `${input.item} · needed by ${input.neededBy}`,
    note: `${input.actor} requested a ${input.item.toLowerCase()} by ${input.neededBy}.${input.note.trim() ? ` ${input.note.trim()}` : ""}`,
  });
}

export async function markAccountInactive(input: {
  companyId: string;
  actor: string;
  reason: string;
}) {
  if (!input.reason.trim()) throw new Error("A reason is required.");
  const db = serverClient();
  const update = await db
    .from("companies")
    .update({ is_active: false, inactive_marked_by: input.actor })
    .eq("id", input.companyId);
  if (update.error) throw new Error(update.error.message);

  const history = await db.from("state_history").insert({
    company_id: input.companyId,
    from_state: null,
    to_state: "Keep in touch",
    actor: "Rep",
    reason: `Flagged inactive by ${input.actor}: ${input.reason.trim()}`,
  });
  if (history.error) throw new Error(history.error.message);

  return await logCrmAction({
    type: "mark_inactive",
    companyId: input.companyId,
    actor: input.actor,
    unit: "Sales",
    subject: "Account flagged inactive",
    note: `${input.actor} flagged this account inactive. Reason: ${input.reason.trim()}`,
  });
}
