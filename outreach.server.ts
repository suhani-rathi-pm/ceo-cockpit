import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { cachedGeneration, hashFacts } from "./cache.server";
import { suggestCollateral, type CollateralItem } from "./collateral.server";

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Outreach drafts.
 *
 * Client-facing, unlike the handoff brief, which is internal. Written from the
 * account's own record, attached to a real piece of collateral, and never sent
 * from this app — a draft is approved, then logged as sent by a person.
 */

export const OUTREACH_CHANNELS = ["Email", "LinkedIn"] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const OUTREACH_STATUSES = ["Draft", "Approved", "Logged as sent"] as const;

export interface OutreachDraftRow {
  id: string;
  channel: string;
  contact_name: string | null;
  subject: string;
  body: string;
  status: string;
  created_by: string;
  created_at: string;
  approved_at: string | null;
  collateral: { id: string; title: string; url: string } | null;
}

export interface GeneratedOutreach {
  company_name: string;
  channel: OutreachChannel;
  contact_name: string | null;
  subject: string;
  body: string;
  cached: boolean;
  cache_hits: number;
  collateral: CollateralItem | null;
  suggested_collateral: CollateralItem[];
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fallback(input: {
  name: string;
  contact: string | null;
  channel: OutreachChannel;
  lastLine: string;
  piece: CollateralItem | null;
}): { subject: string; body: string } {
  const who = input.contact ? input.contact.split(" ")[0] : "there";
  const attach = input.piece
    ? `\n\nI'll send over our ${input.piece.kind.toLowerCase()}, ${input.piece.title}, so you have something concrete to react to.`
    : "";
  return {
    subject: `${input.name} — picking this back up`,
    body: `${who},\n\n${input.lastLine}${attach}\n\nWould a short call in the next week be useful? I'll work around your calendar.\n\nIshwari`,
  };
}

export async function generateOutreachDraft(input: {
  companyId: string;
  channel?: OutreachChannel;
  force?: boolean;
}): Promise<GeneratedOutreach> {
  // Imported lazily: lead.server also reads outreach drafts, and a static
  // import both ways is a cycle waiting to bite.
  const { getLeadDetail } = await import("./lead.server");
  const lead = await getLeadDetail(input.companyId);
  if (!lead) throw new Error("Company not found.");

  const channel: OutreachChannel = input.channel ?? "Email";
  const suggestions = await suggestCollateral(lead.company.industry);
  const piece = suggestions[0] ?? null;

  const last = lead.touchpoints[0] ?? null;
  const contact = last?.contact_name ?? null;
  const news = lead.news[0] ?? null;

  const lastLine = last
    ? `Following our ${last.type.toLowerCase()} on ${fmtDate(last.occurred_at)}, I wanted to pick this back up.`
    : `We have not spoken recently and I wanted to open the conversation properly.`;

  const facts = [
    `Company: ${lead.company.name}`,
    `Industry: ${lead.company.industry ?? "unknown"}`,
    `State: ${lead.run?.state ?? "unclassified"}`,
    last
      ? `Last touchpoint: ${last.type} on ${fmtDate(last.occurred_at)}${contact ? ` with ${contact}${last.contact_title ? `, ${last.contact_title}` : ""}` : ""}. Notes: ${last.notes ?? "none"}.${last.misc_comments ? ` Comment: "${last.misc_comments}".` : ""}`
      : "No touchpoint on record.",
    last?.est_opportunity_size ? `Estimated opportunity: ${last.est_opportunity_size}` : "",
    news
      ? `Recent news about them: ${news.headline} (${news.source_name}, ${fmtDate(news.published_at)})`
      : "",
    piece ? `Collateral to offer: ${piece.kind} — ${piece.title}. ${piece.summary ?? ""}` : "",
    `Channel: ${channel}`,
  ]
    .filter(Boolean)
    .join("\n");

  const model = "google/gemini-2.5-flash";
  const key = `outreach:${channel}:${input.companyId}:${hashFacts(facts)}`;

  const result = await cachedGeneration<{ subject: string; body: string }>({
    key,
    kind: "outreach",
    model,
    force: input.force,
    generate: async () => {
      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) {
        return fallback({ name: lead.company.name, contact, channel, lastLine, piece });
      }
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
                  "You write short client-facing outreach from Ishwari Sardesai, CEO of Programming.com, to a senior contact at a prospective client. Rules: reference the actual last conversation, do not invent facts, no marketing adjectives, no 'I hope this finds you well', no bullet points. Two or three short paragraphs. Offer the named piece of collateral if one is given. End with one clear ask. Sign off 'Ishwari'. For a LinkedIn channel keep it under 90 words and make the subject a one-line opener. Return strict JSON only: {\"subject\": string, \"body\": string}.",
              },
              { role: "user", content: facts },
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
        return fallback({ name: lead.company.name, contact, channel, lastLine, piece });
      }
    },
  });

  return {
    company_name: lead.company.name,
    channel,
    contact_name: contact,
    subject: result.value.subject,
    body: result.value.body,
    cached: result.cached,
    cache_hits: result.hits,
    collateral: piece,
    suggested_collateral: suggestions,
  };
}

export async function listOutreachDrafts(companyId: string): Promise<OutreachDraftRow[]> {
  const db = serverClient();
  const [drafts, collateral] = await Promise.all([
    db
      .from("outreach_drafts")
      .select(
        "id,channel,contact_name,subject,body,status,created_by,created_at,approved_at,collateral_id",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    db.from("collateral").select("id,title,url"),
  ]);
  for (const res of [drafts, collateral]) {
    if (res.error) throw new Error(res.error.message);
  }
  const pieceById = new Map((collateral.data ?? []).map((c) => [c.id, c]));
  return (drafts.data ?? []).map((d) => ({
    id: d.id,
    channel: d.channel,
    contact_name: d.contact_name,
    subject: d.subject,
    body: d.body,
    status: d.status,
    created_by: d.created_by,
    created_at: d.created_at,
    approved_at: d.approved_at,
    collateral: d.collateral_id ? pieceById.get(d.collateral_id) ?? null : null,
  }));
}

export async function saveOutreachDraft(input: {
  companyId: string;
  channel: string;
  contactName: string | null;
  subject: string;
  body: string;
  collateralId: string | null;
  createdBy: string;
}): Promise<{ ok: true }> {
  if (!input.subject.trim() || !input.body.trim()) {
    throw new Error("A draft needs a subject and a body.");
  }
  const db = serverClient();
  const res = await db.from("outreach_drafts").insert({
    company_id: input.companyId,
    channel: input.channel,
    contact_name: input.contactName,
    subject: input.subject.trim(),
    body: input.body.trim(),
    collateral_id: input.collateralId,
    created_by: input.createdBy,
  });
  if (res.error) throw new Error(res.error.message);
  return { ok: true };
}

export async function setOutreachStatus(input: {
  id: string;
  status: string;
}): Promise<{ ok: true }> {
  if (!(OUTREACH_STATUSES as readonly string[]).includes(input.status)) {
    throw new Error("That is not a draft status.");
  }
  const db = serverClient();
  const res = await db
    .from("outreach_drafts")
    .update({
      status: input.status,
      approved_at: input.status === "Draft" ? null : new Date().toISOString(),
    })
    .eq("id", input.id);
  if (res.error) throw new Error(res.error.message);
  return { ok: true };
}

export async function deleteOutreachDraft(id: string): Promise<{ ok: true }> {
  const db = serverClient();
  const res = await db.from("outreach_drafts").delete().eq("id", id);
  if (res.error) throw new Error(res.error.message);
  return { ok: true };
}
