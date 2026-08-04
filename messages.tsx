import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardHead, Empty, Page, PlainBadge } from "@/components/cockpit";
import { StateBadge } from "@/components/StateBadge";
import { BTN_GHOST, BTN_PRIMARY } from "@/components/ActionMenu";
import { FIELD } from "@/components/CrmActionMenu";
import { useAuth } from "@/components/AuthProvider";
import { getMessages, markRead, sendReply } from "@/lib/crm.functions";
import type { CrmMessage } from "@/lib/crm.server";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "From the CEO — Cockpit" },
      {
        name: "description",
        content: "Threaded instructions from the CEO about the accounts you own, with replies.",
      },
      { property: "og:title", content: "From the CEO — Cockpit" },
      {
        property: "og:description",
        content: "Threaded instructions from the CEO about the accounts you own, with replies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});

function longStamp(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Thread({ message, author }: { message: CrmMessage; author: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const reply = useServerFn(sendReply);
  const read = useServerFn(markRead);

  const send = useMutation({
    mutationFn: () => reply({ data: { messageId: message.id, author, body } }),
    onSuccess: async () => {
      toast.success("Reply sent to Ishwari");
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["crm-messages"] });
    },
    onError: (e: Error) => toast.error("Could not send the reply", { description: e.message }),
  });

  const acknowledge = useMutation({
    mutationFn: () => read({ data: { messageId: message.id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm-messages"] });
    },
  });

  return (
    <li
      className={`border-b border-border-soft px-[18px] py-[17px] last:border-b-0 ${
        message.read ? "" : "border-l-[3px] border-l-brand"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2.5">
        <Link
          to="/leads/$companyId"
          params={{ companyId: message.company_id }}
          className="text-[14.5px] font-semibold tracking-[-0.005em] hover:text-brand"
        >
          {message.company_name}
        </Link>
        {message.state ? <StateBadge state={message.state} /> : null}
        {message.read ? null : <PlainBadge>Unread</PlainBadge>}
        <div className="flex-1" />
        <span className="figure text-[11px] text-muted-foreground">
          {longStamp(message.created_at)}
        </span>
      </div>

      <p className="ai-prose max-w-[76ch] text-[15px] leading-[1.62]">{message.body}</p>

      {message.replies.length > 0 ? (
        <ul className="mt-3.5 space-y-2.5 border-l border-border pl-3.5">
          {message.replies.map((r) => (
            <li key={r.id}>
              <span className="eyebrow">
                {r.author} · {longStamp(r.created_at)}
              </span>
              <p className="mt-1 text-[13.5px] text-ink-2">{r.body}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3.5 flex flex-wrap items-end gap-2.5">
        <textarea
          rows={2}
          className={`${FIELD} min-w-[260px] flex-1`}
          placeholder="Reply to Ishwari"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label={`Reply about ${message.company_name}`}
        />
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={!body.trim() || send.isPending}
          onClick={() => send.mutate()}
        >
          {send.isPending ? "Sending…" : "Send reply"}
        </button>
        {message.read ? null : (
          <button
            type="button"
            className={BTN_GHOST}
            disabled={acknowledge.isPending}
            onClick={() => acknowledge.mutate()}
          >
            Mark as read
          </button>
        )}
      </div>
    </li>
  );
}

function MessagesPage() {
  const { user } = useAuth();
  const crmName = user?.crmName ?? user?.name ?? "";
  const fn = useServerFn(getMessages);
  const { data, isPending } = useQuery({
    queryKey: ["crm-messages", crmName],
    queryFn: () => fn({ data: { crmName } }) as Promise<CrmMessage[]>,
    enabled: crmName.length > 0,
  });

  const messages = data ?? [];
  const unread = messages.filter((m) => !m.read).length;

  return (
    <>
      <AppHeader title="From the CEO" />
      <Page>
        <Card>
          <CardHead
            title="From the CEO"
            count={messages.length}
            eyebrow={
              unread > 0
                ? `${unread} unread · each tied to one account`
                : "Everything here has been read"
            }
          />
          {isPending ? (
            <div className="px-[18px] py-[34px] text-center text-[13px] text-muted-foreground">
              Loading your threads…
            </div>
          ) : messages.length === 0 ? (
            <Empty
              title="Nothing from the CEO yet"
              note="When Ishwari sends something about one of your accounts, the thread opens here."
            />
          ) : (
            <ul>
              {messages.map((m) => (
                <Thread key={m.id} message={m} author={crmName} />
              ))}
            </ul>
          )}
        </Card>
      </Page>
    </>
  );
}
