import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { coerceParam, DEFAULT_PARAMS, PARAM_DEFS, type RuntimeParams } from "./params";
import { applyScoringParams } from "./scoring";

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

const PREFIX = "param.";

/** Reads the tuned parameter set, falling back to shipped defaults per key. */
export async function loadParams(): Promise<RuntimeParams> {
  const db = serverClient();
  const res = await db.from("app_settings").select("key,value").like("key", `${PREFIX}%`);
  if (res.error) throw new Error(res.error.message);

  const params: RuntimeParams = { ...DEFAULT_PARAMS };
  for (const row of res.data ?? []) {
    const key = row.key.slice(PREFIX.length);
    const value = Number(row.value);
    if (Number.isFinite(value)) params[key] = coerceParam(key, value);
  }
  return params;
}

/** Persists changed values only. Unknown keys are ignored. */
export async function saveParams(input: RuntimeParams): Promise<RuntimeParams> {
  const db = serverClient();
  const known = new Set(PARAM_DEFS.map((d) => d.key));

  for (const [key, raw] of Object.entries(input)) {
    if (!known.has(key)) continue;
    const value = coerceParam(key, Number(raw));
    if (!Number.isFinite(value)) continue;

    const existing = await db
      .from("app_settings")
      .select("id")
      .eq("key", `${PREFIX}${key}`)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);

    const res = existing.data
      ? await db
          .from("app_settings")
          .update({ value: String(value), updated_at: new Date().toISOString() })
          .eq("id", existing.data.id)
      : await db.from("app_settings").insert({ key: `${PREFIX}${key}`, value: String(value) });
    if (res.error) throw new Error(res.error.message);
  }

  return await loadParams();
}

export async function resetParams(): Promise<RuntimeParams> {
  const db = serverClient();
  const res = await db.from("app_settings").delete().like("key", `${PREFIX}%`);
  if (res.error) throw new Error(res.error.message);
  return await loadParams();
}

/** Loads the tuned set and overlays the scoring half onto CONFIG. */
export async function loadAndApplyParams(): Promise<RuntimeParams> {
  const params = await loadParams();
  applyScoringParams(params);
  return params;
}

/** News-side view of the tuned set. */
export async function loadNewsParams(): Promise<{ minRelevance: number; maxItems: number }> {
  const params = await loadParams();
  return {
    minRelevance: params["news.minRelevance"] ?? DEFAULT_PARAMS["news.minRelevance"]!,
    maxItems: params["news.maxItems"] ?? DEFAULT_PARAMS["news.maxItems"]!,
  };
}
