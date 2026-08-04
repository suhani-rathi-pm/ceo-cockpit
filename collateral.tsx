import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardHead, Empty, Page, Td, Th } from "@/components/cockpit";
import { getCollateralStore } from "@/lib/collateral.functions";
import type { CollateralData, CollateralItem } from "@/lib/collateral.server";

export const Route = createFileRoute("/collateral")({
  loader: () => getCollateralStore(),
  head: () => ({
    meta: [
      { title: "Collateral — CEO Cockpit" },
      {
        name: "description",
        content:
          "What we can actually put in front of a client: decks, case studies and rate cards, by industry and owning unit.",
      },
      { property: "og:title", content: "Collateral — CEO Cockpit" },
      {
        property: "og:description",
        content:
          "What we can actually put in front of a client: decks, case studies and rate cards, by industry and owning unit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CollateralPage,
  errorComponent: () => (
    <>
      <AppHeader title="Collateral" />
      <Page>
        <Card>
          <Empty title="The store could not be loaded" note="Try refreshing." />
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

function ItemRow({ item, stale }: { item: CollateralItem; stale: boolean }) {
  return (
    <tr className="border-b border-border-soft last:border-0">
      <Td>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className="font-display text-[13.5px] font-semibold hover:text-brand"
        >
          {item.title}
        </a>
        {item.summary ? (
          <p className="mt-0.5 max-w-[70ch] text-[12px] text-muted-foreground">{item.summary}</p>
        ) : null}
      </Td>
      <Td>
        <span className="text-[12.5px] text-ink-2">{item.kind}</span>
      </Td>
      <Td>
        <span className="text-[12.5px] text-ink-2">{item.industry ?? "Any industry"}</span>
      </Td>
      <Td>
        <span className="text-[12.5px] text-ink-2">{item.owner_unit}</span>
      </Td>
      <Td className="text-right">
        <span
          className={
            stale
              ? "figure rounded-full bg-state-alert px-2 py-[3px] text-[10.5px] font-medium text-state-alert-foreground"
              : "figure text-[11.5px] text-muted-foreground"
          }
        >
          {dateLabel(item.updated_at)}
        </span>
      </Td>
    </tr>
  );
}

function CollateralPage() {
  const data = Route.useLoaderData() as CollateralData;
  const staleIds = new Set(data.stale.map((s) => s.id));

  return (
    <>
      <AppHeader title="Collateral" />
      <Page>
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em]">Collateral</h1>
          <p className="figure mt-1 text-[11.5px] text-muted-foreground">
            {data.items.length} pieces ·{" "}
            {data.kinds.map((k) => `${k.count} ${k.kind.toLowerCase()}`).join(" · ")}
            {data.stale.length ? ` · ${data.stale.length} not touched in six months` : ""}
          </p>
        </div>

        {data.stale.length > 0 ? (
          <Card className="border-l-2 border-l-state-alert-foreground">
            <CardHead
              title="Going out of date"
              eyebrow="Six months or older · check before it goes to a client"
              count={data.stale.length}
            />
            <ul className="px-[18px] py-[15px]">
              {data.stale.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline gap-2 py-1">
                  <span className="text-[13px] font-medium">{s.title}</span>
                  <span className="figure text-[10.5px] text-muted-foreground">
                    last updated {dateLabel(s.updated_at)} · owned by {s.owner_unit}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card>
          <CardHead
            title="Everything we can send"
            eyebrow="Outreach drafts attach from here"
            count={data.items.length}
          />
          {data.items.length === 0 ? (
            <Empty
              title="Nothing in the store"
              note="Reset the demo data in Settings to load the sample library."
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-soft">
                  <Th>Piece</Th>
                  <Th>Kind</Th>
                  <Th>Industry</Th>
                  <Th>Owner</Th>
                  <Th className="text-right">Updated</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <ItemRow key={item.id} item={item} stale={staleIds.has(item.id)} />
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </Page>
    </>
  );
}
