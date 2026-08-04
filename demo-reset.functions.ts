import { createServerFn } from "@tanstack/react-start";

export interface ResetResult {
  counts: Record<string, number>;
  scoring: { run_date: string; ranked: number; excluded: number };
}

/**
 * Restores the prototype to its original seeded state, then re-runs scoring so
 * the dashboard is immediately populated again. Uses the privileged client
 * because the reset routine is deliberately not callable from the browser.
 */
export const resetDemoData = createServerFn({ method: "POST" }).handler(
  async (): Promise<ResetResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("reset_demo_data");
    if (error) throw new Error(error.message);

    const { executeScoringRun } = await import("./scoring-run.server");
    const scoring = await executeScoringRun();


    return {
      counts: (data ?? {}) as Record<string, number>,
      scoring: {
        run_date: scoring.run_date,
        ranked: scoring.ranked,
        excluded: scoring.excluded,
      },
    };
  },
);
