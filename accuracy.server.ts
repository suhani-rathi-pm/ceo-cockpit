import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export interface TransitionStat {
  predicted_state: string;
  corrected_state: string;
  count: number;
}

export interface AccuracyData {
  total_classifications: number;
  corrections: number;
  accuracy_rate: number | null;
  by_actor: { actor: string; count: number }[];
  transitions: TransitionStat[];
  latest_corrections: {
    id: string;
    company_name: string;
    predicted_state: string | null;
    corrected_state: string | null;
    actor: string;
    reason: string | null;
    created_at: string;
  }[];
}

/**
 * Accuracy of the scoring model, measured purely from state_history.
 * A "classification" is a System-authored row; a "correction" is a human row
 * that carries both predicted_state and corrected_state.
 */
export async function getAccuracyData(): Promise<AccuracyData> {
  const db = serverClient();

  const [history, companies] = await Promise.all([
    db
      .from("state_history")
      .select(
        "id,company_id,from_state,to_state,actor,reason,predicted_state,corrected_state,created_at",
      )
      .order("created_at", { ascending: false }),
    db.from("companies").select("id,name"),
  ]);
  if (history.error) throw new Error(history.error.message);
  if (companies.error) throw new Error(companies.error.message);

  const nameById = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
  const rows = history.data ?? [];

  const systemRows = rows.filter((r) => r.actor === "System");
  const correctionRows = rows.filter(
    (r) => r.actor !== "System" && r.corrected_state !== null && r.predicted_state !== null,
  );

  const total = systemRows.length;
  const corrections = correctionRows.length;

  const actorCounts = new Map<string, number>();
  for (const r of correctionRows) {
    actorCounts.set(r.actor, (actorCounts.get(r.actor) ?? 0) + 1);
  }

  const transitionCounts = new Map<string, number>();
  for (const r of correctionRows) {
    const key = `${r.predicted_state} → ${r.corrected_state}`;
    transitionCounts.set(key, (transitionCounts.get(key) ?? 0) + 1);
  }

  return {
    total_classifications: total,
    corrections,
    accuracy_rate: total === 0 ? null : Math.max(0, (total - corrections) / total),
    by_actor: [...actorCounts.entries()]
      .map(([actor, count]) => ({ actor, count }))
      .sort((a, b) => b.count - a.count),
    transitions: [...transitionCounts.entries()]
      .map(([key, count]) => {
        const [predicted_state = "", corrected_state = ""] = key.split(" → ");
        return { predicted_state, corrected_state, count };
      })
      .sort((a, b) => b.count - a.count),
    latest_corrections: correctionRows.slice(0, 8).map((r) => ({
      id: r.id,
      company_name: nameById.get(r.company_id) ?? "Unknown company",
      predicted_state: r.predicted_state,
      corrected_state: r.corrected_state,
      actor: r.actor,
      reason: r.reason,
      created_at: r.created_at,
    })),
  };
}
