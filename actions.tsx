import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardHead, Empty, Page, Td, Th } from "@/components/cockpit";
import { FIELD } from "@/components/CrmActionMenu";
import { getActions, updateActionStatus } from "@/lib/actions.functions";
import type { ActionRow, ActionsData, ActionType } from "@/lib/actions.server";
import { ACTION_STATUSES, type ActionStatus } from "@/lib/actions.constants";

export const Route = createFileRoute("/actions")({
  loader: () => getActions(),
  head: () => ({
    meta: [
      { title: "Actions — Cockpit" },
      {
        name: "description",
        content: "Everything routed, emailed or flagged, grouped by whether it is still open.",
      },
      { property: "og:title", content: "Actions — Cockpit" },
      {
        property: "og:description",
        content: "Everything routed, emailed or flagged, grouped by whether it is still open.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActionsPage,
  errorComponent: () => (
    <>
      <AppHeader title="Actions" />
      <Page>
        <Card>
          <div className="px-[18px] py-[34px] text-center text-[13px] text-muted-foreground">
            The action queue could not be loaded. Try refreshing.
          </div>
        </Card>
      </Page>
    </>
  ),
  notFoundComponent: () => (
    <>
      <AppHeader title="Actions" />
      <Page>
        <Empty title="Nothing here" />
      </Page>
    </>
  ),
});

const TYPE_LABEL: Record<ActionType, string> = {
  route_to_unit: "Routed",
  email_handoff: "Chief of staff",
  message_owner: "Message to owner",
  revise_opportunity: "Size revised",
  flag_for_ceo: "Flagged up",
  collateral_request: "Collateral",
  mark_inactive: "Marked inactive",
};

function TypeBadge({ type }: { type: ActionType }) {
  const email = type === "email_handoff";
  return (
    <span
      className={`figure inline-flex whitespace-nowrap rounded-full px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.06em] ${
        email
          ? "bg-state-opportunity text-state-opportunity-foreground"
          : "bg-border-soft text-ink-2"
      }`}
      title={email ? "Drafted in-app, never sent" : undefined}
    >
      {TYPE_LABEL[type] ?? "Action"}
    </span>
  );
}

function StatusSelect({ row }: { row: ActionRow }) {
  const router = useRouter();
  const update = useServerFn(updateActionStatus);
  const mutation = useMutation({
    mutationFn: (status: ActionStatus) => update({ data: { actionId: row.id, status } }),
    onSuccess: async (_data, status) => {
      toast.success(`${row.company_name} → ${status.toLowerCase()}`);
      await router.invalidate();
    },
    onError: (e: Error) => toast.error("Could not move it along", { description: e.message }),
  });

  return (
    <select
      className={FIELD}
      value={row.status}
      disabled={mutation.isPending}
      aria-label={`Status for ${row.company_name}`}
      onChange={(e) => mutation.mutate(e.target.value as ActionStatus)}
    >
      {ACTION_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

function Row({ row }: { row: ActionRow }) {
  const [open, setOpen] = useState(false);
  const isEmail = row.type === "email_handoff";

  return (
    <>
      <tr className="transition-colors hover:bg-[#F7F8F8]">
        <Td>
          <Link
            to="/leads/$companyId"
            params={{ companyId: row.company_id }}
            className="text-[14px] font-semibold tracking-[-0.005em] hover:text-brand"
          >
            {row.company_name}
          </Link>
          <span className="mt-[1px] block text-[11.5px] text-muted-foreground">
            {row.routed_to_unit}
          </span>
        </Td>
        <Td>
          <TypeBadge type={row.type} />
        </Td>
        <Td className="max-w-[440px] text-[13px] text-ink-2">
          {isEmail ? (
            <>
              <span className="block font-semibold text-foreground">
                {row.subject ?? "No subject"}
              </span>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="mt-1 text-[12.5px] font-medium text-brand underline decoration-brand/30 underline-offset-[3px]"
              >
                {open ? "Hide the body" : "Show the body"}
              </button>
            </>
          ) : (
            (row.note?.trim() ?? "") || "—"
          )}
        </Td>
        <Td className="figure text-right text-[12px] text-muted-foreground">{row.age_days}d</Td>
        <Td className="w-[170px]">
          <StatusSelect row={row} />
        </Td>
      </tr>
      {isEmail && open ? (
        <tr>
          <Td colSpan={5} className="bg-[#F7F8F8]">
            <span className="eyebrow block">Drafted, never sent · prototype record</span>
            <p className="ai-prose mt-2 max-w-[80ch] whitespace-pre-wrap text-[14.5px]">
              {row.body ?? "No body stored."}
            </p>
          </Td>
        </tr>
      ) : null}
    </>
  );
}

function ActionsPage() {
  const data = Route.useLoaderData() as ActionsData;

  return (
    <>
      <AppHeader title="Actions" />
      <Page>
        {data.groups.map((group) => (
          <Card key={group.status}>
            <CardHead
              title={group.status}
              count={group.rows.length}
              eyebrow={`${data.counts.Open} open · ${data.counts["In progress"]} in progress · ${data.counts.Resolved} resolved`}
            />
            {group.rows.length === 0 ? (
              <Empty
                title={`Nothing ${group.status.toLowerCase()}`}
                note="Route something from the dashboard to see it here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] border-collapse text-[13.5px]">
                  <thead>
                    <tr>
                      <Th>Account</Th>
                      <Th className="w-[140px]">Type</Th>
                      <Th>Context</Th>
                      <Th className="w-[70px]">Age</Th>
                      <Th className="w-[170px]">Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <Row key={row.id} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ))}
      </Page>
    </>
  );
}
