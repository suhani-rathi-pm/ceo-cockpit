import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowUpRight, ChevronLeft } from "lucide-react";
import {
  ACTION_LABEL,
  ActionModals,
  BTN_GHOST,
  BTN_PRIMARY,
  type ActionKind,
} from "@/components/ActionMenu";
import { AppHeader } from "@/components/AppHeader";
import { confidenceLabel, confidenceTone, SOURCE_NOTE } from "@/lib/sources";
import { StateBadge } from "@/components/StateBadge";
import {
  Card,
  CardHead,
  Meta,
  Narrative,
  Page,
  PlainBadge,
  Td,
  Th,
  highlight,
} from "@/components/cockpit";
import { getLead } from "@/lib/lead.functions";
import type { LeadDetail } from "@/lib/lead.server";
import type { CompanyState } from "@/lib/scoring";

export const Route = createFileRoute("/leads/$companyId")({
  loader: async ({ params }) => {
    const lead = (await getLead({ data: { companyId: params.companyId } })) as LeadDetail | null;
    if (!lead) throw notFound();
    return lead;
  },
  head: ({ loaderData }) => {
    const data = loaderData as LeadDetail | undefined;
    if (!data) {
      return {
        meta: [{ title: "Account unavailable — CEO Cockpit" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${data.company.name} — CEO Cockpit`;
    const description = `Recommended next move, score working and full history for ${data.company.name}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: LeadDetailPage,
  notFoundComponent: () => (
    <>
      <AppHeader title="Account" />
      <Page>
        <Card>
          <div className="px-[18px] py-[34px] text-center text-[13px] text-muted-foreground">
            No account with that id.{" "}
            <Link to="/leads" className="underline underline-offset-[3px]">
              Back to leads
            </Link>
          </div>
        </Card>
      </Page>
    </>
  ),
});

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function LeadDetailPage() {
  const lead = Route.useLoaderData() as LeadDetail;
  const [which, setWhich] = useState<ActionKind | null>(null);
  const { company, run, recommendation: rec } = lead;
  const breakdown = run?.breakdown ?? null;
  const state = (run?.state ?? null) as CompanyState | null;

  const secondary = (["email", "outreach", "note", "route", "correct", "lost"] as ActionKind[]).filter(
    (k) => k !== rec.primary,
  );

  return (
    <>
      <AppHeader title={company.name} />
      <Page>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/leads"
            className="figure inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            All leads
          </Link>
          <div className="flex-1" />
          {state ? <StateBadge state={state} /> : null}
          <Meta>
            {run
              ? `Rank ${run.rank ?? "—"} · run ${run.run_date}`
              : "Not in the latest scoring run"}
          </Meta>
        </div>

        <div>
          <h1 className="font-display text-[25px] font-semibold tracking-[-0.02em]">
            {company.name}
          </h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {company.industry ?? "Industry unknown"} · {company.headcount_band ?? "Headcount unknown"} ·
            ICP {company.icp_fit ?? "Unknown"} · owner {lead.owner ?? "unassigned"} ·{" "}
            {lead.touchpoints.length} touchpoint{lead.touchpoints.length === 1 ? "" : "s"}
            {company.is_active ? "" : " · marked inactive"}
          </p>
        </div>

        {/* The answer, first. */}
        <section className="rounded-md border border-border border-t-[3px] border-t-brand bg-card px-[26px] py-[22px]">
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <span className="eyebrow">Recommended next move</span>
            <div className="flex-1" />
            <span className="figure rounded-full bg-state-alert px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.06em] text-state-alert-foreground">
              By {rec.by}
            </span>
          </div>

          <p className="max-w-[62ch] font-display text-[19.5px] font-semibold leading-[1.35] tracking-[-0.02em]">
            {rec.move}
          </p>

          <ol className="mt-[18px] max-w-[74ch] space-y-2.5">
            {rec.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-[13.5px] leading-[1.6] text-ink-2">
                <span className="figure mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-wash text-[10.5px] font-medium text-brand">
                  {i + 1}
                </span>
                <span>{highlight(step)}</span>
              </li>
            ))}
          </ol>

          <div className="mt-[18px] flex flex-wrap gap-x-9 gap-y-2 rounded-md border border-border-soft bg-[#F8FAFA] px-4 py-3">
            <div>
              <span className="eyebrow block">Who</span>
              <span className="mt-[3px] block text-[13px] font-medium">{rec.who}</span>
            </div>
            <div>
              <span className="eyebrow block">By when</span>
              <span className="mt-[3px] block text-[13px] font-medium">{rec.by}</span>
            </div>
          </div>

          <div className="mt-3.5 rounded-md border border-state-alert-border bg-state-alert-wash px-4 py-3">
            <span className="eyebrow block text-state-alert-foreground">If nothing happens</span>
            <p className="mt-1.5 text-[13px] leading-[1.6] text-state-alert-foreground">{rec.risk}</p>
          </div>

          <div className="mt-[18px] flex flex-wrap items-center gap-2.5 border-t border-border-soft pt-3.5">
            <button type="button" className={BTN_PRIMARY} onClick={() => setWhich(rec.primary)}>
              {ACTION_LABEL[rec.primary]}
            </button>
            {secondary.map((k) => (
              <button key={k} type="button" className={BTN_GHOST} onClick={() => setWhich(k)}>
                {ACTION_LABEL[k]}
              </button>
            ))}
          </div>
        </section>

        <Narrative eyebrow="Why this surfaced" paragraphs={[rec.why]} />

        <Card>
          <CardHead
            title="How this score was built"
            count={breakdown?.touchpoints.length ?? 0}
            eyebrow="Deterministic · no model involved"
          />
          {breakdown ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse">
                <thead>
                  <tr>
                    <Th>Touchpoint</Th>
                    <Th>Contact title</Th>
                    <Th className="text-right">Seniority</Th>
                    <Th className="text-right">Opportunity</Th>
                    <Th className="text-right">Adjusted rating</Th>
                    <Th className="text-right">Score</Th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.touchpoints.map((t) => (
                    <tr key={t.touchpoint_id} className="hover:bg-[#F8FAFA]">
                      <Td>
                        <span className="text-[13px] font-medium">{t.type}</span>
                        <span className="figure mt-[1px] block text-[11px] text-muted-foreground">
                          {dateLabel(t.occurred_at)} ·{" "}
                          {t.star_rating === null
                            ? `no rating · email placeholder ${t.adjusted_rating / t.credibility_multiplier}`
                            : `${t.star_rating}★`}{" "}
                          · credibility ×{t.credibility_multiplier}
                        </span>
                      </Td>
                      <Td className="text-[12.5px] text-ink-2">{t.contact_title ?? "—"}</Td>
                      <Td className="figure text-right text-[12.5px]">{t.seniority_weight}</Td>
                      <Td className="figure text-right text-[12.5px]">
                        {t.opportunity_weight}
                        <span className="ml-1.5 text-[10.5px] text-muted-foreground">
                          {t.opportunity_size}
                        </span>
                      </Td>
                      <Td className="figure text-right text-[12.5px]">
                        {t.adjusted_rating.toFixed(2)}
                      </Td>
                      <Td className="figure text-right text-[13px] font-semibold">
                        {t.score.toFixed(1)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <Td colSpan={5} className="text-[12.5px] text-ink-2">
                      Rollup — every touchpoint summed, not averaged
                    </Td>
                    <Td className="figure text-right text-[13px] font-semibold">
                      {breakdown.rollup.toFixed(1)}
                    </Td>
                  </tr>
                  <tr>
                    <Td colSpan={5} className="text-[12.5px] text-ink-2">
                      ICP multiplier — {breakdown.icp.fit}
                      {breakdown.icp.missing ? " (missing, neutral applied — no penalty)" : ""}
                    </Td>
                    <Td className="figure text-right text-[13px] font-semibold">
                      ×{breakdown.icp.multiplier}
                    </Td>
                  </tr>
                  <tr>
                    <Td colSpan={5} className="border-b-0 font-display text-[13.5px] font-semibold">
                      Final score
                    </Td>
                    <Td className="figure border-b-0 text-right font-display text-[16px] font-semibold">
                      {breakdown.final_score.toFixed(1)}
                    </Td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="px-[18px] py-[34px] text-center text-[13px] text-muted-foreground">
              No scoring run covers this account yet.
            </p>
          )}
          {breakdown?.classification.reason ? (
            <p className="border-t border-border-soft px-[18px] py-3 text-[12px] leading-[1.6] text-muted-foreground">
              {breakdown.classification.reason}
              {breakdown.exclusion.excluded
                ? ` · Excluded: ${breakdown.exclusion.reasons.join("; ")}`
                : ""}
            </p>
          ) : null}
        </Card>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <Card>
            <CardHead
              title="Touchpoint history"
              count={lead.touchpoints.length}
              eyebrow={
                lead.sources.total === 0
                  ? "Nothing captured yet"
                  : `${lead.sources.systems.map((s) => `${s.count} from ${s.system}`).join(" · ")} · ${
                      lead.sources.manual
                    } entered by hand${
                      lead.sources.mean_confidence === null
                        ? ""
                        : ` · mean extraction confidence ${lead.sources.mean_confidence.toFixed(2)}`
                    }`
              }
            />
            {lead.touchpoints.length === 0 ? (
              <p className="px-[18px] py-[34px] text-center text-[13px] text-muted-foreground">
                Nothing recorded against this account.
              </p>
            ) : (
              <ul>
                {lead.touchpoints.map((t) => (
                  <li key={t.id} className="border-b border-border-soft px-[18px] py-3.5 last:border-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold">{t.type}</span>
                      <PlainBadge>{t.crm_name ?? "No owner"}</PlainBadge>
                      <PlainBadge>{t.star_rating === null ? "No rating" : `${t.star_rating}★`}</PlainBadge>
                      <div className="flex-1" />
                      <Meta>{dateLabel(t.occurred_at)}</Meta>
                    </div>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                      {t.contact_name ?? "Contact unknown"}
                      {t.contact_title ? ` · ${t.contact_title}` : ""} ·{" "}
                      {t.est_opportunity_size ?? "Opportunity unknown"}
                    </p>
                    {t.notes ? (
                      <p className="mt-1.5 text-[13px] leading-[1.6] text-ink-2">{t.notes}</p>
                    ) : null}
                    {t.misc_comments ? (
                      <p className="mt-1.5 border-l-2 border-brand/30 pl-2.5 text-[12.5px] italic leading-[1.6] text-muted-foreground">
                        {t.misc_comments}
                      </p>
                    ) : null}
                    <p className="figure mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-muted-foreground">
                      <span
                        className={
                          confidenceTone(t.extraction_confidence) === "low"
                            ? "rounded-full bg-state-alert px-2 py-[2px] font-medium text-state-alert-foreground"
                            : "rounded-full bg-border-soft px-2 py-[2px] font-medium text-ink-2"
                        }
                      >
                        {t.source_system}
                      </span>
                      <span>{confidenceLabel(t.extraction_confidence)}</span>
                      {t.source_ref ? <span>· {t.source_ref}</span> : null}
                      {SOURCE_NOTE[t.source_system] ? (
                        <span>· {SOURCE_NOTE[t.source_system]}</span>
                      ) : null}
                    </p>
                    {t.source_excerpt ? (
                      <p className="mt-1 text-[12px] leading-[1.6] text-muted-foreground">
                        Captured: “{t.source_excerpt}”
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHead title="Attached news" count={lead.news.length} />
              {lead.news.length === 0 ? (
                <p className="px-[18px] py-[26px] text-center text-[13px] text-muted-foreground">
                  Nothing matched to this account.
                </p>
              ) : (
                <ul>
                  {lead.news.map((n) => (
                    <li key={n.id} className="border-b border-border-soft px-[18px] py-3.5 last:border-0">
                      <a
                        href={n.source_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="group inline-flex items-start gap-1.5 text-[13px] font-semibold leading-[1.45] hover:text-brand"
                      >
                        {n.headline}
                        <ArrowUpRight
                          className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-brand"
                          aria-hidden
                        />
                      </a>
                      <p className="figure mt-1 text-[11px] text-muted-foreground">
                        {n.source_name} · {dateLabel(n.published_at)} · relevance{" "}
                        {n.relevance_score.toFixed(2)}
                      </p>
                      {n.why_it_matters ? (
                        <p className="ai-prose mt-1.5 text-[13px]">{n.why_it_matters}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHead
                title="What we can send"
                count={lead.collateral.length}
                eyebrow="Matched on industry, then the generic pieces"
              />
              {lead.collateral.length === 0 ? (
                <p className="px-[18px] py-[26px] text-center text-[13px] text-muted-foreground">
                  Nothing in the store yet · reset the demo data to load the library.
                </p>
              ) : (
                <ul>
                  {lead.collateral.map((c) => (
                    <li
                      key={c.id}
                      className="border-b border-border-soft px-[18px] py-3 last:border-0"
                    >
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[13px] font-semibold hover:text-brand"
                      >
                        {c.title}
                      </a>
                      <p className="figure mt-0.5 text-[10.5px] text-muted-foreground">
                        {c.kind} · {c.industry ?? "Any industry"} · {c.owner_unit}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHead
                title="Outreach drafts"
                count={lead.outreach.length}
                eyebrow="Client-facing · drafted here, sent by a person"
              />
              {lead.outreach.length === 0 ? (
                <p className="px-[18px] py-[26px] text-center text-[13px] text-muted-foreground">
                  Nothing drafted · use “Draft outreach to the account” from the Action menu.
                </p>
              ) : (
                <ul>
                  {lead.outreach.map((d) => (
                    <li
                      key={d.id}
                      className="border-b border-border-soft px-[18px] py-3.5 last:border-0"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold">{d.subject}</span>
                        <div className="flex-1" />
                        <PlainBadge>{d.status}</PlainBadge>
                      </div>
                      <p className="figure mt-1 text-[10.5px] text-muted-foreground">
                        {d.channel}
                        {d.contact_name ? ` · to ${d.contact_name}` : ""} · {d.created_by} ·{" "}
                        {dateLabel(d.created_at)}
                        {d.collateral ? ` · attached ${d.collateral.title}` : ""}
                      </p>
                      <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-[1.6] text-ink-2">
                        {d.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHead title="State history" count={lead.history.length} />
              {lead.history.length === 0 ? (
                <p className="px-[18px] py-[26px] text-center text-[13px] text-muted-foreground">
                  No transitions recorded.
                </p>
              ) : (
                <ul>
                  {lead.history.map((h) => (
                    <li key={h.id} className="border-b border-border-soft px-[18px] py-3 last:border-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="figure text-[11.5px]">
                          {h.from_state ?? "—"} → {h.to_state}
                        </span>
                        <PlainBadge>{h.actor}</PlainBadge>
                        <div className="flex-1" />
                        <Meta>{dateLabel(h.created_at)}</Meta>
                      </div>
                      {h.reason ? (
                        <p className="mt-1 text-[12.5px] leading-[1.6] text-ink-2">{h.reason}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>

        <ActionModals
          target={{
            companyId: company.id,
            companyName: company.name,
            currentState: state,
            owner: lead.owner,
          }}
          which={which}
          onClose={() => setWhich(null)}
        />
      </Page>
    </>
  );
}
