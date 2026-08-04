import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ActionMenu } from "@/components/ActionMenu";
import { AppHeader } from "@/components/AppHeader";
import { StateBadge } from "@/components/StateBadge";
import { Card, CardHead, ChipButton, Empty, Page, Td, Th } from "@/components/cockpit";
import { getLeads } from "@/lib/leads.functions";
import type { LeadListRow, LeadsListData } from "@/lib/leads.server";

export const Route = createFileRoute("/leads/")({
  loader: () => getLeads(),
  head: () => ({
    meta: [
      { title: "Leads — CEO Cockpit" },
      {
        name: "description",
        content:
          "Every account in the book, ranked by the latest run, with excluded and incomplete rows kept visible.",
      },
      { property: "og:title", content: "Leads — CEO Cockpit" },
      {
        property: "og:description",
        content:
          "Every account in the book, ranked by the latest run, with excluded and incomplete rows kept visible.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeadsPage,
  errorComponent: () => (
    <>
      <AppHeader title="Leads" />
      <Page>
        <Card>
          <Empty title="Leads could not be loaded" note="Try refreshing." />
        </Card>
      </Page>
    </>
  ),
});

const FILTERS = [
  "All active",
  "Pipeline",
  "Opportunity",
  "Keep in touch",
  "Needs review",
  "Excluded",
] as const;
type Filter = (typeof FILTERS)[number];

function LeadsPage() {
  const data = Route.useLoaderData() as LeadsListData;
  const [filter, setFilter] = useState<Filter>("All active");

  const rows = useMemo<LeadListRow[]>(() => {
    const all = data.rows;
    switch (filter) {
      case "Excluded":
        return all.filter((r) => r.excluded);
      case "Needs review":
        return all.filter((r) => r.icp_missing && !r.excluded);
      case "All active":
        return all.filter((r) => !r.excluded);
      default:
        return all.filter((r) => !r.excluded && r.state === filter);
    }
  }, [data.rows, filter]);

  const countFor = (f: Filter) => {
    const all = data.rows;
    if (f === "Excluded") return all.filter((r) => r.excluded).length;
    if (f === "Needs review") return all.filter((r) => r.icp_missing && !r.excluded).length;
    if (f === "All active") return all.filter((r) => !r.excluded).length;
    return all.filter((r) => !r.excluded && r.state === f).length;
  };

  return (
    <>
      <AppHeader title="Leads" />
      <Page>
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em]">The book</h1>
          <p className="figure mt-1 text-[11.5px] text-muted-foreground">
            {data.counts.total} accounts · {data.counts.included} active ·{" "}
            {data.counts.excluded} excluded ·{" "}
            {data.run_date ? `run ${data.run_date}` : "no scoring run yet"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <ChipButton key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f}
              <span className="figure ml-1.5 text-[10.5px] opacity-70">{countFor(f)}</span>
            </ChipButton>
          ))}
        </div>

        <Card>
          <CardHead
            title={filter}
            count={rows.length}
            eyebrow={
              filter === "Excluded"
                ? "Kept, not deleted — reason shown inline"
                : filter === "Needs review"
                  ? "Neutral multiplier applied · position provisional"
                  : "Ranked by the latest run"
            }
          />
          {rows.length === 0 ? (
            <Empty title="Nothing in this band" note="Try another filter." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse">
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Company</Th>
                    <Th>State</Th>
                    <Th>Tier</Th>
                    <Th>Last touch</Th>
                    <Th>Owner</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.company_id} className="last:[&>td]:border-b-0 hover:bg-[#F8FAFA]">
                      <Td className="figure w-[26px] text-[12px] text-muted-foreground">
                        {row.rank ?? "—"}
                      </Td>
                      <Td>
                        <Link
                          to="/leads/$companyId"
                          params={{ companyId: row.company_id }}
                          className="block"
                        >
                          <span className="text-[14px] font-semibold tracking-[-0.005em] hover:text-brand">
                            {row.name}
                          </span>
                          {row.news_count > 0 ? (
                            <span className="figure ml-2 rounded-[3px] bg-brand-wash px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.08em] text-brand">
                              News
                            </span>
                          ) : null}
                          <span className="mt-[1px] block text-[11.5px] text-muted-foreground">
                            {row.industry ?? "Industry unknown"} · ICP {row.icp_fit} ·{" "}
                            {row.touchpoint_count} touchpoint
                            {row.touchpoint_count === 1 ? "" : "s"}
                          </span>
                          {row.excluded ? (
                            <span className="figure mt-1 block text-[10.5px] uppercase tracking-[0.07em] text-state-alert-foreground">
                              Excluded — {row.exclusion_reasons.join("; ")}
                            </span>
                          ) : null}
                          {!row.excluded && row.icp_missing ? (
                            <span className="figure mt-1 block text-[10.5px] uppercase tracking-[0.07em] text-state-alert-foreground">
                              Incomplete ICP — position provisional
                            </span>
                          ) : null}
                        </Link>
                      </Td>
                      <Td>{row.state ? <StateBadge state={row.state} /> : "—"}</Td>
                      <Td className="figure text-[12.5px] whitespace-nowrap">
                        {row.tier_label ?? "—"}
                      </Td>
                      <Td className="figure text-[12.5px] whitespace-nowrap">
                        {row.days_since_last_touchpoint === null
                          ? "—"
                          : `${row.days_since_last_touchpoint}d`}
                      </Td>
                      <Td className="figure text-[12.5px] whitespace-nowrap">
                        {row.owner_crm ?? "Unassigned"}
                      </Td>
                      <Td className="text-right">
                        <ActionMenu
                          companyId={row.company_id}
                          companyName={row.name}
                          currentState={row.state}
                          owner={row.owner_crm}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Page>
    </>
  );
}
