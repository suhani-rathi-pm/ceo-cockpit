import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CONNECTORS, type ConnectorRow } from "./connectors";

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export interface RunStage {
  stage: string;
  status: string;
  duration_ms: number;
  records: number;
  confidence: number | null;
  detail: string | null;
}

export interface ObservabilityData {
  last_run: {
    run_date: string;
    total_ms: number;
    failed: number;
    stages: RunStage[];
  } | null;
  history: { run_date: string; total_ms: number; stages: number; failed: number }[];
  /** Connector problems, promoted out of the simulated connector table. */
  incidents: { source: string; health: ConnectorRow["health"]; note: string }[];
  extraction: {
    touchpoints: number;
    unrated: number;
    /** Share of touchpoints that carry a human-entered rating. */
    confidence: number;
    missing_icp: number;
    missing_contact: number;
  };
}

export async function getObservability(): Promise<ObservabilityData> {
  const db = serverClient();

  const [log, touchpoints, companies] = await Promise.all([
    db
      .from("run_log")
      .select("run_date,pipeline,stage,status,duration_ms,records,confidence,detail,sequence")
      .order("run_date", { ascending: false })
      .order("sequence", { ascending: true })
      .limit(200),
    db.from("touchpoints").select("id,star_rating,type,contact_id"),
    db.from("companies").select("id,icp_fit,icp_subscores"),
  ]);
  for (const res of [log, touchpoints, companies]) {
    if (res.error) throw new Error(res.error.message);
  }

  const rows = log.data ?? [];
  const byDate = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!byDate.has(row.run_date)) byDate.set(row.run_date, []);
    byDate.get(row.run_date)!.push(row);
  }

  const history = [...byDate.entries()].map(([run_date, stages]) => ({
    run_date,
    total_ms: stages.reduce((sum, s) => sum + (s.duration_ms ?? 0), 0),
    stages: stages.length,
    failed: stages.filter((s) => s.status !== "ok").length,
  }));

  const latestDate = history[0]?.run_date ?? null;
  const latestStages = latestDate ? (byDate.get(latestDate) ?? []) : [];

  const tps = touchpoints.data ?? [];
  const unrated = tps.filter((t) => t.star_rating === null).length;
  const comps = companies.data ?? [];

  return {
    last_run: latestDate
      ? {
          run_date: latestDate,
          total_ms: latestStages.reduce((sum, s) => sum + (s.duration_ms ?? 0), 0),
          failed: latestStages.filter((s) => s.status !== "ok").length,
          stages: latestStages.map((s) => ({
            stage: s.stage,
            status: s.status,
            duration_ms: s.duration_ms ?? 0,
            records: s.records ?? 0,
            confidence: s.confidence === null ? null : Number(s.confidence),
            detail: s.detail,
          })),
        }
      : null,
    history: history.slice(0, 6),
    incidents: CONNECTORS.filter((c) => c.health !== "Healthy").map((c) => ({
      source: c.name,
      health: c.health,
      note: c.note,
    })),
    extraction: {
      touchpoints: tps.length,
      unrated,
      confidence: tps.length ? Math.round(((tps.length - unrated) / tps.length) * 100) / 100 : 1,
      missing_icp: comps.filter(
        (c) => !c.icp_fit || c.icp_fit === "Unknown" || c.icp_subscores === null,
      ).length,
      missing_contact: tps.filter((t) => !t.contact_id).length,
    },
  };
}
