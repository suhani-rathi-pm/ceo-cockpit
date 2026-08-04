import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export { ACTION_STATUSES, BUSINESS_UNITS } from "./actions.constants";
export type { ActionStatus } from "./actions.constants";
import { ACTION_STATUSES, type ActionStatus } from "./actions.constants";


export type ActionType =
  | "route_to_unit"
  | "email_handoff"
  | "message_owner"
  | "revise_opportunity"
  | "flag_for_ceo"
  | "collateral_request"
  | "mark_inactive";

export interface ActionRow {
  id: string;
  type: ActionType;
  subject: string | null;
  body: string | null;
  company_id: string;
  company_name: string;
  routed_to_unit: string;
  status: ActionStatus;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
  age_days: number;
}

export interface ActionsData {
  counts: Record<ActionStatus, number>;
  groups: { status: ActionStatus; rows: ActionRow[] }[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function getActionsData(now = new Date()): Promise<ActionsData> {
  const db = serverClient();

  const [actions, companies] = await Promise.all([
    db
      .from("actions")
      .select("id,company_id,routed_to_unit,status,note,created_at,resolved_at,type,subject,body")
      .order("created_at", { ascending: false }),
    db.from("companies").select("id,name"),
  ]);
  if (actions.error) throw new Error(actions.error.message);
  if (companies.error) throw new Error(companies.error.message);

  const nameById = new Map((companies.data ?? []).map((c) => [c.id, c.name]));

  const rows: ActionRow[] = (actions.data ?? []).map((a) => ({
    id: a.id,
    type: (a.type as ActionType) ?? "route_to_unit",
    subject: a.subject,
    body: a.body,
    company_id: a.company_id,
    company_name: nameById.get(a.company_id) ?? "Unknown company",
    routed_to_unit: a.routed_to_unit,
    status: (a.status as ActionStatus) ?? "Open",
    note: a.note,
    created_at: a.created_at,
    resolved_at: a.resolved_at,
    age_days: Math.max(
      0,
      Math.floor(
        ((a.resolved_at ? new Date(a.resolved_at).getTime() : now.getTime()) -
          new Date(a.created_at).getTime()) /
          MS_PER_DAY,
      ),
    ),
  }));

  const counts = { Open: 0, "In progress": 0, Resolved: 0 } as Record<ActionStatus, number>;
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;

  return {
    counts,
    groups: ACTION_STATUSES.map((status) => ({
      status,
      rows: rows.filter((r) => r.status === status),
    })),
  };
}

/** Business unit or CEO moves a routed item along the queue. */
export async function setActionStatus(input: {
  actionId: string;
  status: ActionStatus;
}): Promise<{ ok: true }> {
  const db = serverClient();
  const res = await db
    .from("actions")
    .update({
      status: input.status,
      resolved_at: input.status === "Resolved" ? new Date().toISOString() : null,
    })
    .eq("id", input.actionId);
  if (res.error) throw new Error(res.error.message);
  return { ok: true };
}

/**
 * A note from the CEO to the CRM who owns the relationship. Logged as an open
 * item so it shows up on the Actions page — the prototype never sends anything.
 */
export async function logOwnerMessage(input: {
  companyId: string;
  owner: string;
  body: string;
}): Promise<{ ok: true }> {
  const db = serverClient();
  const res = await db.from("actions").insert({
    company_id: input.companyId,
    routed_to_unit: input.owner,
    status: "Open",
    note: input.body,
    type: "message_owner",
  });
  if (res.error) throw new Error(res.error.message);
  return { ok: true };
}
