import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Entity resolution.
 *
 * Names arrive from six systems and they do not agree: "Vantage Freight",
 * "Vantage Frieght Systems", "Nordwind". Anything the matcher is not sure about
 * is parked here rather than guessed, because a wrong match silently moves a
 * score. A person confirms or rejects, and the decision is kept.
 */

export interface AliasRow {
  id: string;
  alias: string;
  source_system: string;
  occurrences: number;
  confidence: number | null;
  status: string;
  suggested: { id: string; name: string } | null;
  resolved: { id: string; name: string } | null;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface EntityResolutionData {
  pending: AliasRow[];
  settled: AliasRow[];
  companies: { id: string; name: string }[];
  stats: {
    pending: number;
    confirmed: number;
    rejected: number;
    /** Share of decided aliases the matcher had already suggested correctly. */
    suggestion_accuracy: number | null;
  };
}

export async function getEntityResolution(): Promise<EntityResolutionData> {
  const db = serverClient();

  const [aliases, companies] = await Promise.all([
    db
      .from("entity_aliases")
      .select(
        "id,alias,source_system,occurrences,confidence,status,suggested_company_id,resolved_company_id,resolved_by,created_at,resolved_at",
      )
      .order("occurrences", { ascending: false })
      .order("created_at", { ascending: false }),
    db.from("companies").select("id,name").order("name"),
  ]);
  for (const res of [aliases, companies]) {
    if (res.error) throw new Error(res.error.message);
  }

  const nameById = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
  const ref = (id: string | null) =>
    id ? { id, name: nameById.get(id) ?? "Unknown company" } : null;

  const rows: AliasRow[] = (aliases.data ?? []).map((a) => ({
    id: a.id,
    alias: a.alias,
    source_system: a.source_system,
    occurrences: a.occurrences,
    confidence: a.confidence === null ? null : Number(a.confidence),
    status: a.status,
    suggested: ref(a.suggested_company_id),
    resolved: ref(a.resolved_company_id),
    resolved_by: a.resolved_by,
    created_at: a.created_at,
    resolved_at: a.resolved_at,
  }));

  const pending = rows.filter((r) => r.status === "pending");
  const settled = rows.filter((r) => r.status !== "pending");
  const confirmed = settled.filter((r) => r.status === "confirmed");
  const agreed = confirmed.filter((r) => r.suggested && r.resolved?.id === r.suggested.id).length;

  return {
    pending,
    settled,
    companies: companies.data ?? [],
    stats: {
      pending: pending.length,
      confirmed: confirmed.length,
      rejected: settled.length - confirmed.length,
      suggestion_accuracy: confirmed.length === 0 ? null : agreed / confirmed.length,
    },
  };
}

/** Confirm links the alias to an account; reject parks it as "not one of ours". */
export async function decideAlias(input: {
  id: string;
  action: "confirm" | "reject";
  companyId?: string | null;
  actor: string;
}): Promise<{ ok: true }> {
  const db = serverClient();

  if (input.action === "confirm" && !input.companyId) {
    throw new Error("Pick the account this name belongs to.");
  }

  const res = await db
    .from("entity_aliases")
    .update({
      status: input.action === "confirm" ? "confirmed" : "rejected",
      resolved_company_id: input.action === "confirm" ? input.companyId! : null,
      resolved_by: input.actor,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (res.error) throw new Error(res.error.message);
  return { ok: true };
}

/** Reopens a decision — the queue is a working surface, not an archive. */
export async function reopenAlias(id: string): Promise<{ ok: true }> {
  const db = serverClient();
  const res = await db
    .from("entity_aliases")
    .update({ status: "pending", resolved_company_id: null, resolved_by: null, resolved_at: null })
    .eq("id", id);
  if (res.error) throw new Error(res.error.message);
  return { ok: true };
}
