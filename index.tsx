import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { AudioDigest } from "@/components/AudioDigest";
import { CrmDashboard } from "@/components/CrmDashboard";
import { useAuth } from "@/components/AuthProvider";
import { LeadTable } from "@/components/LeadTable";

import { StateBadge } from "@/components/StateBadge";
import {
  AlertBadge,
  Card,
  CardHead,
  Fold,
  Narrative,
  NarrativeFoot,
  Page,
} from "@/components/cockpit";
import type { DashboardRow } from "@/lib/dashboard.server";
import { getDashboard } from "@/lib/dashboard.functions";
import { getDigest } from "@/lib/digest.functions";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [dashboard, digest] = await Promise.all([getDashboard(), getDigest()]);
    return { dashboard, digest };
  },

  head: () => ({
    meta: [
      { title: "Morning briefing — CEO Cockpit" },
      {
        name: "description",
        content:
          "The accounts that need the CEO today, ranked, with a written briefing and the news that moved them.",
      },
      { property: "og:title", content: "Morning briefing — CEO Cockpit" },
      {
        property: "og:description",
        content:
          "The accounts that need the CEO today, ranked, with a written briefing and the news that moved them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
  errorComponent: () => (
    <>
      <AppHeader title="Dashboard" />
      <Page>
        <Card>
          <div className="px-[18px] py-[34px] text-center text-[13px] text-muted-foreground">
            The morning briefing could not be loaded. Try refreshing.
          </div>
        </Card>
      </Page>
    </>
  ),
});

function DashboardPage() {
  const { user } = useAuth();
  const { dashboard: data, digest } = Route.useLoaderData();
  const { summary, briefing } = data;

  // Account owners get their own product: their book, their instructions, their queue.
  if (user?.role === "crm") {
    return (
      <>
        <AppHeader title="My accounts" />
        <CrmDashboard crmName={user.crmName ?? user.name} />
      </>
    );
  }

  // A super admin manages access and never sees lead data.
  if (user?.role === "admin") {
    return (
      <>
        <AppHeader title="Dashboard" />
        <Page>
          <Card>
            <div className="px-[18px] py-[34px] text-center text-[13px] text-muted-foreground">
              A super admin manages people and configuration only.{" "}
              <Link to="/people" className="font-medium text-brand underline underline-offset-[3px]">
                Open people & roles
              </Link>
            </div>
          </Card>
        </Page>
      </>
    );
  }


  return (
    <>
      <AppHeader title="Dashboard" />
      <Page>
        <Narrative eyebrow={briefing.eyebrow} paragraphs={briefing.paragraphs}>
          <NarrativeFoot>
            <AudioDigest digest={digest} />
          </NarrativeFoot>
          <p className="figure mt-3 text-[11px] text-muted-foreground">
            {data.run_date
              ? `${summary.pipeline} needing you · ${summary.moved_since_yesterday} moved since the last run · ${summary.news_items} news items matched · run ${data.run_date}`
              : "No scoring run yet."}{" "}
            <Link
              to="/settings"
              className="underline decoration-border underline-offset-[3px] hover:text-foreground"
            >
              Re-run scoring
            </Link>
          </p>
        </Narrative>

        <Card>
          <CardHead
            title="Needs you today"
            count={data.pipeline.length}
            eyebrow="Ranked · top of the run, touched in the last 7 days"
          />
          <LeadTable rows={data.pipeline} showRank />
        </Card>

        <Fold
          title="Opportunity"
          count={data.opportunity.length}
          eyebrow="High score, gone quiet"
        >
          <LeadTable rows={data.opportunity} showRank />
        </Fold>

        <Fold
          title="Keep in touch"
          count={data.keep_in_touch.length}
          eyebrow="Active, not competing for attention this week"
        >
          <LeadTable rows={data.keep_in_touch} />
        </Fold>

        {data.needs_review.length > 0 ? (
          <section className="rounded-md border border-state-alert-border bg-state-alert-wash">
            <div className="flex flex-wrap items-center gap-2.5 border-b border-state-alert-border px-[18px] py-3.5">
              <h3 className="font-display text-[14.5px] font-semibold tracking-[-0.01em]">
                Held back — incomplete data
              </h3>
              <AlertBadge>{data.needs_review.length} account</AlertBadge>
              <div className="flex-1" />
              <span className="eyebrow">Provisional · not ranked against the rest</span>
            </div>
            <p className="border-b border-state-alert-border px-[18px] py-3 text-[12.5px] leading-[1.65] text-ink-2">
              No ICP profile on file, so the neutral multiplier was applied — nothing has been
              penalised or dropped. These positions stay provisional until the profile is completed.
            </p>
            <ul>
              {(data.needs_review as DashboardRow[]).map((row) => (
                <li
                  key={row.company_id}
                  className="flex flex-wrap items-center gap-3 border-b border-state-alert-border/60 px-[18px] py-3.5 last:border-0"
                >
                  <Link
                    to="/leads/$companyId"
                    params={{ companyId: row.company_id }}
                    className="min-w-0"
                  >
                    <span className="text-[14px] font-semibold tracking-[-0.005em] hover:text-brand">
                      {row.name}
                    </span>
                    <span className="mt-[1px] block text-[11.5px] text-muted-foreground">
                      {row.industry ?? "Industry unknown"} · ICP {row.icp_fit} ·{" "}
                      {row.touchpoint_count} touchpoint{row.touchpoint_count === 1 ? "" : "s"} ·
                      owner {row.owner_crm ?? "unassigned"}
                    </span>
                  </Link>
                  <div className="flex-1" />
                  <StateBadge state={row.state} />
                  <span className="figure text-[11px] text-muted-foreground">
                    provisional rank {row.rank ?? "—"}
                  </span>
                  <Link
                    to="/leads/$companyId"
                    params={{ companyId: row.company_id }}
                    className="figure rounded-[5px] border border-state-alert-border bg-card px-3 py-[6px] text-[11.5px] font-medium text-ink-2 hover:border-ink-2/40"
                  >
                    Complete the profile
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Page>
    </>
  );
}
