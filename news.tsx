import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { ArrowUpRight, X } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { StateBadge } from "@/components/StateBadge";
import { Card, CardHead, Empty, Page } from "@/components/cockpit";
import type { NewsItemRow, NewsTuning } from "@/lib/news.server";
import { applyRelevanceFloor, dismissNewsItem, getNews } from "@/lib/news.functions";
import { DISMISS_REASONS } from "@/lib/news.constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/news")({
  loader: () => getNews(),
  head: () => ({
    meta: [
      { title: "News briefing — CEO Cockpit" },
      {
        name: "description",
        content:
          "Account-linked and market news, filtered for relevance and written against our actual position with each account.",
      },
      { property: "og:title", content: "News briefing — CEO Cockpit" },
      {
        property: "og:description",
        content:
          "Account-linked and market news, filtered for relevance and written against our actual position with each account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewsPage,
  errorComponent: () => (
    <>
      <AppHeader title="News" />
      <Page>
        <Card>
          <Empty title="The briefing could not be loaded" note="Try refreshing." />
        </Card>
      </Page>
    </>
  ),
});

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function NewsItem({
  item,
  onDismiss,
  dismissing,
}: {
  item: NewsItemRow;
  onDismiss: (id: string, reason: string) => void;
  dismissing: boolean;
}) {
  return (
    <article className="border-b border-border-soft px-[18px] py-[17px] last:border-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[15px] font-semibold leading-[1.4] tracking-[-0.01em]">
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer noopener"
              className="group inline-flex items-start gap-1.5 hover:text-brand"
            >
              {item.headline}
              <ArrowUpRight
                className="mt-[4px] h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-brand"
                aria-hidden
              />
            </a>
          </h3>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer noopener"
              className="figure text-[11px] font-medium text-ink-2 underline decoration-border underline-offset-[3px] hover:text-brand"
            >
              {item.source_name}
            </a>
            <span className="figure text-[11px] text-muted-foreground" aria-hidden>
              ·
            </span>
            <span className="figure text-[11px] text-muted-foreground">
              {formatDate(item.published_at)}
            </span>
            {item.company ? (
              <>
                <span className="figure text-[11px] text-muted-foreground" aria-hidden>
                  ·
                </span>
                <Link
                  to="/leads/$companyId"
                  params={{ companyId: item.company.id }}
                  className="text-[12px] font-semibold hover:text-brand"
                >
                  {item.company.name}
                </Link>
                {item.company.state ? <StateBadge state={item.company.state} /> : null}
              </>
            ) : null}
          </p>

          {item.why_it_matters ? (
            <div className="mt-2.5">
              <span className="eyebrow">Why it matters</span>
              <p className="ai-prose mt-1 max-w-[74ch] text-[14px]">{item.why_it_matters}</p>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className="figure rounded-full bg-border-soft px-2 py-[3px] text-[10.5px] font-medium text-ink-2"
            title="Relevance score"
          >
            {item.relevance_score.toFixed(2)}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Dismiss: ${item.headline}`}
                disabled={dismissing}
                className="rounded-[5px] border border-border bg-card p-[5px] text-muted-foreground transition-colors hover:border-ink-2/40 hover:text-foreground disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="eyebrow font-normal">Dismiss because</DropdownMenuLabel>
              {DISMISS_REASONS.map((reason) => (
                <DropdownMenuItem
                  key={reason}
                  className="text-[13px]"
                  onSelect={() => onDismiss(item.id, reason)}
                >
                  {reason}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}

function NewsPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);

  const dismiss = useServerFn(dismissNewsItem);
  const mutation = useMutation({
    mutationFn: (input: { id: string; reason: string }) => dismiss({ data: input }),
    onSuccess: async (_r, input) => {
      toast.success("Dismissed", { description: `Recorded as "${input.reason}" for tuning.` });
      await router.invalidate();
    },
    onError: (error: Error) => toast.error("Could not dismiss", { description: error.message }),
  });

  const applyFloor = useServerFn(applyRelevanceFloor);
  const floorMutation = useMutation({
    mutationFn: (value: number) => applyFloor({ data: { value } }),
    onSuccess: async (r) => {
      toast.success("Relevance floor raised", {
        description: `Now ${r.min_relevance.toFixed(2)}. It applies from the next briefing.`,
      });
      await router.invalidate();
    },
    onError: (error: Error) => toast.error("Could not change the floor", {
      description: error.message,
    }),
  });

  const onDismiss = (id: string, reason: string) => mutation.mutate({ id, reason });

  const all: NewsItemRow[] = [...data.account_linked, ...data.market_sector];
  const visibleIds = new Set(
    showAll ? all.map((i) => i.id) : all.slice(0, data.stats.shown).map((i) => i.id),
  );
  const accountLinked = data.account_linked.filter((i: NewsItemRow) => visibleIds.has(i.id));
  const marketSector = data.market_sector.filter((i: NewsItemRow) => visibleIds.has(i.id));
  const hidden = all.length - visibleIds.size;

  return (
    <>
      <AppHeader title="News" />
      <Page>
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em]">
            News briefing
          </h1>
          <p className="figure mt-1 text-[11.5px] text-muted-foreground">
            {data.stats.ingested} articles ingested · {data.stats.passed} passed the relevance filter
            (≥ {data.stats.min_relevance.toFixed(2)}) · {visibleIds.size} shown ·{" "}
            {data.stats.below_threshold} held below the floor · {data.stats.dismissed} dismissed
          </p>
        </div>

        <Card>
          <CardHead
            title="Relevance tuning"
            eyebrow="Dismissals feed the filter"
            count={data.tuning.dismissals}
          />
          <div className="px-[18px] py-[17px]">
            {data.tuning.suggestion ? (
              <p className="ai-prose max-w-[74ch] text-[14px]">{data.tuning.suggestion}</p>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Nothing dismissed yet · dismiss a story with a reason and the floor becomes
                tunable from the evidence.
              </p>
            )}

            {data.tuning.recent.length ? (
              <ul className="mt-3 space-y-1.5">
                {data.tuning.recent.map((r: NewsTuning["recent"][number]) => (
                  <li key={`${r.headline}-${r.created_at}`} className="flex items-baseline gap-2">
                    <span className="figure shrink-0 text-[10.5px] text-muted-foreground">
                      {r.relevance_score === null ? "—" : r.relevance_score.toFixed(2)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">
                      {r.headline}
                    </span>
                    <span className="figure shrink-0 text-[10.5px] text-muted-foreground">
                      {r.reason}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {data.tuning.suggested_min_relevance !== null ? (
              <button
                type="button"
                disabled={floorMutation.isPending}
                onClick={() => floorMutation.mutate(data.tuning.suggested_min_relevance!)}
                className="mt-3.5 inline-flex items-center rounded-[5px] bg-brand px-3 py-[6px] text-[12.5px] font-medium text-white hover:bg-brand-ink disabled:opacity-50"
              >
                Raise the floor to {data.tuning.suggested_min_relevance.toFixed(2)}
              </button>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHead
            title="Account-linked"
            count={accountLinked.length}
            eyebrow="Matched to an account in the book"
          />
          {accountLinked.length === 0 ? (
            <Empty title="Nothing matched an account" note="Only market context today." />
          ) : (
            accountLinked.map((item: NewsItemRow) => (
              <NewsItem
                key={item.id}
                item={item}
                onDismiss={onDismiss}
                dismissing={mutation.isPending}
              />
            ))
          )}
        </Card>

        <Card>
          <CardHead
            title="Market & sector"
            count={marketSector.length}
            eyebrow="No account match · context only"
          />
          {marketSector.length === 0 ? (
            <Empty title="No market news in the briefing" />
          ) : (
            marketSector.map((item: NewsItemRow) => (
              <NewsItem
                key={item.id}
                item={item}
                onDismiss={onDismiss}
                dismissing={mutation.isPending}
              />
            ))
          )}
        </Card>

        {hidden > 0 || showAll ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="figure self-start rounded-[5px] border border-border bg-card px-3 py-[7px] text-[11.5px] font-medium text-ink-2 hover:border-ink-2/40"
          >
            {showAll ? `Show top ${data.stats.shown} only` : `Show ${hidden} more`}
          </button>
        ) : null}
      </Page>
    </>
  );
}
