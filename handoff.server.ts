import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getLeadDetail } from "./lead.server";
import { cachedGeneration, hashFacts } from "./cache.server";

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

const COS_KEY = "chief_of_staff_email";
const COS_FALLBACK = "chief.of.staff@programming.com";

export async function getChiefOfStaffEmail(): Promise<string> {
  const db = serverClient();
  const res = await db.from("app_settings").select("value").eq("key", COS_KEY).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data?.value ?? COS_FALLBACK;
}

export async function setChiefOfStaffEmail(email: string): Promise<{ ok: true; email: string }> {
  const clean = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("That is not a valid email address.");
  const db = serverClient();
  const res = await db
    .from("app_settings")
    .upsert({ key: COS_KEY, value: clean }, { onConflict: "key" });
  if (res.error) throw new Error(res.error.message);
  return { ok: true, email: clean };
}

export interface HandoffDraft {
  subject: string;
  body: string;
  recipient: string;
  company_name: string;
  /** True when the brief was reused rather than generated again. */
  cached: boolean;
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Deterministic fallback used if the model call fails — the modal must always open with a draft. */
function fallbackDraft(name: string, facts: string): { subject: string; body: string } {
  return {
    subject: `Handoff: ${name} — progress this week`,
    body: `Taking you through ${name} so you can run it from here.\n\n${facts}\n\nNext step: pick this up this week, confirm the decision timeline and log the outcome against the account.`,
  };
}

/**
 * Internal delegation brief, generated from today's scoring run and the
 * account's own record. Direct tone by instruction — no pleasantries.
 */
export async function generateHandoffDraft(
  companyId: string,
  force = false,
): Promise<HandoffDraft> {
  const [lead, recipient] = await Promise.all([getLeadDetail(companyId), getChiefOfStaffEmail()]);
  if (!lead) throw new Error("Company not found.");

  const last = lead.touchpoints[0];
  const news = lead.news.slice(0, 2);
  const b = lead.run?.breakdown ?? null;

  const facts = [
    `Score ${lead.run ? lead.run.final_score.toFixed(1) : "n/a"}, rank ${lead.run?.rank ?? "unranked"}, state ${lead.run?.state ?? "unclassified"}.`,
    `ICP fit ${lead.company.icp_fit ?? "Unknown"}${lead.company.industry ? `, ${lead.company.industry}` : ""}.`,
    b ? `Classification reason: ${b.classification.reason}` : "",
    last
      ? `Last touchpoint: ${last.type} on ${fmtDate(last.occurred_at)}${last.contact_name ? ` with ${last.contact_name}${last.contact_title ? `, ${last.contact_title}` : ""}` : ""}${last.crm_name ? ` (owner ${last.crm_name})` : ""}. Notes: ${last.notes ?? "none"}.${last.misc_comments ? ` Comment: "${last.misc_comments}".` : ""}`
      : "No touchpoint on record.",
    `Touchpoints on record: ${lead.touchpoints.length}.`,
    news.length > 0
      ? `Account-linked news: ${news.map((n) => `${n.headline} (${n.source_name}, ${fmtDate(n.published_at)})${n.why_it_matters ? ` — ${n.why_it_matters}` : ""}`).join(" | ")}`
      : "No account-linked news.",
  ]
    .filter(Boolean)
    .join("\n");

  const model = "google/gemini-2.5-flash";
  const generate = async (): Promise<{ subject: string; body: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return fallbackDraft(lead.company.name, facts);
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "You write short internal delegation briefs from a CEO to their Chief of Staff, handing over an account to progress. This is NOT client outreach. Rules: no greeting, no pleasantries, no filler opening, no sign-off, no marketing language. Direct declarative sentences. Cover in order: (1) why this company surfaced today, (2) its score and rank in one line, (3) the last touchpoint and what came out of it, (4) any account-linked news, (5) a recommended next step. Keep it under 180 words. Return strict JSON only: {\"subject\": string, \"body\": string}. Body uses plain text with blank lines between paragraphs.",
            },
            { role: "user", content: `Company: ${lead.company.name}\n\n${facts}` },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) throw new Error(`AI gateway ${res.status}`);
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "") as {
        subject?: string;
        body?: string;
      };
      if (!parsed.subject || !parsed.body) throw new Error("Incomplete draft");
      return { subject: parsed.subject, body: parsed.body };
    } catch {
      return fallbackDraft(lead.company.name, facts);
    }
  };

  // The facts only change when the run changes, so the same brief is never paid
  // for twice. "Regenerate" forces a fresh call.
  const result = await cachedGeneration({
    key: `handoff:${companyId}:${hashFacts(facts)}`,
    kind: "handoff",
    model,
    force,
    generate,
  });

  return {
    subject: result.value.subject,
    body: result.value.body,
    recipient,
    company_name: lead.company.name,
    cached: result.cached,
  };
}

/** Drafted-not-sent: we only record the handoff as an action row. */
export async function logHandoffAsSent(input: {
  companyId: string;
  subject: string;
  body: string;
}): Promise<{ ok: true }> {
  const db = serverClient();
  const res = await db.from("actions").insert({
    company_id: input.companyId,
    routed_to_unit: "Chief of Staff",
    status: "Open",
    note: "Handoff email drafted and logged as sent (prototype — no email leaves the system).",
    type: "email_handoff",
    subject: input.subject,
    body: input.body,
  });
  if (res.error) throw new Error(res.error.message);
  return { ok: true };
}
