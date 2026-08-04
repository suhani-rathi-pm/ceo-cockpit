import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardHead, Page } from "@/components/cockpit";
import { BTN_GHOST, BTN_PRIMARY } from "@/components/ActionMenu";
import { FIELD, FieldLabel, StarPicker } from "@/components/CrmActionMenu";
import { useAuth } from "@/components/AuthProvider";
import { OPPORTUNITY_SIZES, TOUCHPOINT_TYPES } from "@/lib/crm.constants";
import { getAccounts, logActivity, markInactive } from "@/lib/crm.functions";
import type { AccountOption } from "@/lib/crm.server";

const NEW_ACCOUNT = "__new__";

export const Route = createFileRoute("/log-activity")({
  validateSearch: (search: Record<string, unknown>): { account?: string } =>
    typeof search["account"] === "string" ? { account: search["account"] } : {},
  head: () => ({
    meta: [
      { title: "Log activity — Cockpit" },
      {
        name: "description",
        content: "Record a meeting, call, email or event against an account before the next run.",
      },
      { property: "og:title", content: "Log activity — Cockpit" },
      {
        property: "og:description",
        content: "Record a meeting, call, email or event against an account before the next run.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LogActivityPage,
});

function LogActivityPage() {
  const { account: preselected } = Route.useSearch();
  const { user } = useAuth();
  const crmName = user?.crmName ?? user?.name ?? "";
  const queryClient = useQueryClient();

  const accountsFn = useServerFn(getAccounts);
  const { data: accounts } = useQuery({
    queryKey: ["crm-accounts", crmName],
    queryFn: () => accountsFn({ data: { crmName } }) as Promise<AccountOption[]>,
    enabled: crmName.length > 0,
  });

  const [account, setAccount] = useState(preselected ?? "");
  const [newName, setNewName] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [type, setType] = useState<string>(TOUCHPOINT_TYPES[0]);
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [size, setSize] = useState<string>(OPPORTUNITY_SIZES[4]);
  const [stars, setStars] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [misc, setMisc] = useState("");

  useEffect(() => {
    if (preselected) setAccount(preselected);
  }, [preselected]);

  const isEmail = type === "Email";
  const isNew = account === NEW_ACCOUNT;

  const submit = useServerFn(logActivity);
  const save = useMutation({
    mutationFn: () =>
      submit({
        data: {
          companyId: isNew ? null : account,
          newCompanyName: newName,
          newCompanyIndustry: newIndustry,
          submittedBy: crmName,
          type,
          contactName,
          contactTitle,
          occurredOn,
          estOpportunitySize: size,
          starRating: isEmail ? null : stars,
          notes,
          miscComments: misc,
        },
      }),
    onSuccess: async (res) => {
      toast.success(`Logged against ${res.company_name}`, {
        description: "It enters scoring at the 04:30 run.",
      });
      setContactName("");
      setContactTitle("");
      setNotes("");
      setMisc("");
      setStars(null);
      setNewName("");
      setNewIndustry("");
      await queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Could not log the touchpoint", { description: e.message }),
  });

  const ready =
    (isNew ? newName.trim().length > 0 : account.length > 0) && notes.trim().length > 0;

  return (
    <>
      <AppHeader title="Log activity" />
      <Page>
        <Card>
          <CardHead title="Log a touchpoint" eyebrow="Scored at the next 04:30 run" />
          <div className="grid gap-4 px-[18px] py-[18px] sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="la-account">Account</FieldLabel>
              <select
                id="la-account"
                className={FIELD}
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">Select an account</option>
                {(accounts ?? []).map((a) => (
                  <option key={a.company_id} value={a.company_id}>
                    {a.name}
                    {a.mine ? " · yours" : ""}
                  </option>
                ))}
                <option value={NEW_ACCOUNT}>+ New account…</option>
              </select>
            </div>

            {isNew ? (
              <>
                <div>
                  <FieldLabel htmlFor="la-new-name">New account name</FieldLabel>
                  <input
                    id="la-new-name"
                    className={FIELD}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="la-new-industry">Industry</FieldLabel>
                  <input
                    id="la-new-industry"
                    className={FIELD}
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                  />
                </div>
              </>
            ) : null}

            <div>
              <FieldLabel htmlFor="la-type">Touchpoint type</FieldLabel>
              <select
                id="la-type"
                className={FIELD}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {TOUCHPOINT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="la-date">Date</FieldLabel>
              <input
                id="la-date"
                type="date"
                className={FIELD}
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="la-contact">Contact name</FieldLabel>
              <input
                id="la-contact"
                className={FIELD}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="la-title">Their title</FieldLabel>
              <input
                id="la-title"
                className={FIELD}
                value={contactTitle}
                onChange={(e) => setContactTitle(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="la-size">Estimated opportunity size</FieldLabel>
              <select
                id="la-size"
                className={FIELD}
                value={size}
                onChange={(e) => setSize(e.target.value)}
              >
                {OPPORTUNITY_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="la-stars">Star rating</FieldLabel>
              <div id="la-stars">
                <StarPicker value={stars} onChange={setStars} disabled={isEmail} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="la-notes">What happened</FieldLabel>
              <textarea
                id="la-notes"
                rows={4}
                className={FIELD}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="la-misc">Anything else worth knowing</FieldLabel>
              <textarea
                id="la-misc"
                rows={3}
                className={FIELD}
                value={misc}
                onChange={(e) => setMisc(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={!ready || save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? "Submitting…" : "Submit the touchpoint"}
              </button>
            </div>
          </div>
        </Card>

        <FlagInactive accounts={accounts ?? []} actor={crmName} />
      </Page>
    </>
  );
}

function FlagInactive({ accounts, actor }: { accounts: AccountOption[]; actor: string }) {
  const queryClient = useQueryClient();
  const [company, setCompany] = useState("");
  const [reason, setReason] = useState("");
  const fn = useServerFn(markInactive);
  const m = useMutation({
    mutationFn: () => fn({ data: { companyId: company, actor, reason } }),
    onSuccess: async () => {
      toast.success("Account flagged inactive", {
        description: "It drops off the board at the next run, with your reason attached.",
      });
      setReason("");
      setCompany("");
      await queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Could not flag the account", { description: e.message }),
  });

  return (
    <Card>
      <CardHead title="Flag an account inactive" eyebrow="A reason is required" />
      <div className="grid gap-4 px-[18px] py-[18px] sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="fi-account">Account</FieldLabel>
          <select
            id="fi-account"
            className={FIELD}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            <option value="">Select an account</option>
            {accounts.map((a) => (
              <option key={a.company_id} value={a.company_id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="fi-reason">Reason</FieldLabel>
          <input
            id="fi-reason"
            className={FIELD}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="button"
            className={BTN_GHOST}
            disabled={!company || !reason.trim() || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending ? "Flagging…" : "Flag it inactive"}
          </button>
        </div>
      </div>
    </Card>
  );
}
