import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { runScoring, type CompanyState } from "./scoring";
import { tunedKeys } from "./params";

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export interface ScoringRunResult {
  run_date: string;
  companies_scored: number;
  ranked: number;
  excluded: number;
  states: Record<string, number>;
  state_changes: number;
  top: { name: string; final_score: number; state: CompanyState | null }[];
}

/**
 * Executes a full scoring run and persists score_runs + state_history rows.
 * Every stage writes a run_log row — duration, records and status — so the
 * Settings observability panel can show where a run spent its time and which
 * stage failed. The log is written even when a stage throws.
 */
export async function executeScoringRun(now = new Date()): Promise<ScoringRunResult> {
  const db = serverClient();
  const runDateForLog = now.toISOString().slice(0, 10);
  const stages: {
    run_date: string;
    pipeline: string;
    stage: string;
    status: string;
    duration_ms: number;
    records: number;
    confidence: number | null;
    detail: string | null;
  }[] = [];

  const stage = async <T,>(
    name: string,
    fn: () => Promise<T>,
    describe?: (value: T) => { records?: number; confidence?: number; detail?: string },
  ): Promise<T> => {
    const started = Date.now();
    try {
      const value = await fn();
      const meta = describe?.(value) ?? {};
      stages.push({
        run_date: runDateForLog,
        pipeline: "scoring",
        stage: name,
        status: "ok",
        duration_ms: Date.now() - started,
        records: meta.records ?? 0,
        confidence: meta.confidence ?? null,
        detail: meta.detail ?? null,
      });
      return value;
    } catch (error) {
      stages.push({
        run_date: runDateForLog,
        pipeline: "scoring",
        stage: name,
        status: "failed",
        duration_ms: Date.now() - started,
        records: 0,
        confidence: null,
        detail: error instanceof Error ? error.message : String(error),
      });
      await flushStages(db, stages);
      throw error;
    }
  };

  // Tuned parameters are overlaid before anything is read, so the whole run
  // uses one consistent parameter set.
  const params = await stage(
    "Load tuned parameters",
    async () => {
      const { loadAndApplyParams } = await import("./params.server");
      return await loadAndApplyParams();
    },
    (p) => {
      const tuned = tunedKeys(p);
      return {
        records: Object.keys(p).length,
        detail: tuned.length ? `${tuned.length} tuned away from defaults` : "all defaults",
      };
    },
  );
  void params;

  const [companies, contacts, crms, touchpoints, history] = await stage(
    "Read source records",
    async () => {
      const results = await Promise.all([
        db.from("companies").select("id,name,icp_fit,icp_subscores,is_active"),
        db.from("contacts").select("id,title"),
        db.from("crms").select("id,credibility_multiplier"),
        db
          .from("touchpoints")
          .select(
            "id,company_id,contact_id,crm_id,type,star_rating,est_opportunity_size,occurred_at",
          ),
        db
          .from("state_history")
          .select("company_id,to_state,created_at")
          .order("created_at", { ascending: true }),
      ]);
      for (const res of results) if (res.error) throw new Error(res.error.message);
      return results;
    },
    ([c, ct, cr, tp]) => {
      const rows = tp.data ?? [];
      // Emails and unrated calls are the extraction gap; report it as confidence.
      const rated = rows.filter((r) => r.star_rating !== null).length;
      return {
        records:
          (c.data?.length ?? 0) + (ct.data?.length ?? 0) + (cr.data?.length ?? 0) + rows.length,
        confidence: rows.length ? Math.round((rated / rows.length) * 100) / 100 : 1,
        detail: `${rows.length} touchpoints · ${rows.length - rated} without a rating`,
      };
    },
  );

  // Latest known state per company (used for from_state and to detect changes).
  const previousState = new Map<string, string>();
  for (const row of history.data ?? []) previousState.set(row.company_id, row.to_state);

  const manualLost = new Set(
    [...previousState.entries()].filter(([, s]) => s === "Lost").map(([id]) => id),
  );

  const scores = await stage(
    "Score and classify",
    async () =>
      runScoring({
        companies: companies.data ?? [],
        contacts: contacts.data ?? [],
        crms: crms.data ?? [],
        touchpoints: touchpoints.data ?? [],
        now,
        manualLost,
      }),
    (rows) => ({
      records: rows.length,
      detail: `${rows.filter((r) => !r.excluded).length} ranked · ${rows.filter((r) => r.excluded).length} excluded`,
    }),
  );

  const runDate = now.toISOString().slice(0, 10);

  await stage(
    "Persist scores",
    async () => {
      // Replace today's run so re-running is idempotent.
      const delRun = await db.from("score_runs").delete().eq("run_date", runDate);
      if (delRun.error) throw new Error(delRun.error.message);

      const insertRuns = await db.from("score_runs").insert(
        scores.map((s) => ({
          company_id: s.company_id,
          run_date: runDate,
          raw_score: s.raw_score,
          final_score: s.final_score,
          rank: s.rank,
          classified_state: s.classified_state,
          score_breakdown: s.score_breakdown as never,
        })),
      );
      if (insertRuns.error) throw new Error(insertRuns.error.message);
      return scores.length;
    },
    (n) => ({ records: n }),
  );

  // Every classification is logged; changes carry the previous state.
  const historyRows = scores
    .filter((s) => s.classified_state !== null)
    .map((s) => {
      const from = previousState.get(s.company_id) ?? null;
      return {
        company_id: s.company_id,
        from_state: from,
        to_state: s.classified_state as string,
        actor: "System",
        reason: s.reason,
        predicted_state: s.classified_state as string,
        corrected_state: null,
      };
    });

  await stage(
    "Write state history",
    async () => {
      if (historyRows.length === 0) return 0;
      const insertHistory = await db.from("state_history").insert(historyRows);
      if (insertHistory.error) throw new Error(insertHistory.error.message);
      return historyRows.length;
    },
    (n) => ({
      records: n,
      detail: `${historyRows.filter((r) => r.from_state !== r.to_state).length} state changes`,
    }),
  );

  await flushStages(db, stages);

  const states: Record<string, number> = {};
  for (const s of scores) {
    const key = s.classified_state ?? "Excluded";
    states[key] = (states[key] ?? 0) + 1;
  }

  return {
    run_date: runDate,
    companies_scored: scores.length,
    ranked: scores.filter((s) => !s.excluded).length,
    excluded: scores.filter((s) => s.excluded).length,
    states,
    state_changes: historyRows.filter(
      (r) => r.from_state !== r.to_state,
    ).length,
    top: scores
      .filter((s) => s.rank !== null)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      .slice(0, 6)
      .map((s) => ({ name: s.company_name, final_score: s.final_score, state: s.classified_state })),
  };
}

/** Replaces today's log for this pipeline, then writes the stages in order. */
async function flushStages(
  db: ReturnType<typeof serverClient>,
  stages: {
    run_date: string;
    pipeline: string;
    stage: string;
    status: string;
    duration_ms: number;
    records: number;
    confidence: number | null;
    detail: string | null;
  }[],
) {
  if (stages.length === 0) return;
  const runDate = stages[0]!.run_date;
  await db.from("run_log").delete().eq("run_date", runDate).eq("pipeline", "scoring");
  await db.from("run_log").insert(stages.map((s, i) => ({ ...s, sequence: i + 1 })));
}
