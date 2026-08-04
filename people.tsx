import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardHead, Empty, Page, Td, Th } from "@/components/cockpit";
import { BTN_GHOST } from "@/components/ActionMenu";
import { FIELD, FieldLabel } from "@/components/CrmActionMenu";
import { changeRole, createPerson, listPeople } from "@/lib/people.functions";
import type { PersonRow } from "@/lib/people.server";
import { ROLE_LABEL, WORK_DOMAIN, type Role } from "@/lib/roles";

const ROLES: Role[] = ["ceo", "cos", "vp", "crm", "admin"];

const ROLE_SCOPE: Record<Role, string> = {
  ceo: "The full board: every account, the briefing, the news, and every action. Can correct a classification, mark an account lost and email the chief of staff.",
  cos: "The same board as the CEO, read-first. Picks up delegated handoffs and moves routed work along.",
  vp: "The board across their unit, plus the actions routed to it. No people or configuration access.",
  crm: "Only the accounts they own: their briefing, the CEO's messages to them, activity logging and their own queue. No classification control.",
  admin: "People and roles only. A super admin manages access and sees no lead, score or news data at all.",
};

export const Route = createFileRoute("/people")({
  head: () => ({
    meta: [
      { title: "People & roles — Cockpit" },
      {
        name: "description",
        content: "Who has Cockpit access, what role each person holds, and what each role can see.",
      },
      { property: "og:title", content: "People & roles — Cockpit" },
      {
        property: "og:description",
        content: "Who has Cockpit access, what role each person holds, and what each role can see.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PeoplePage,
});

function RoleSelect({ person }: { person: PersonRow }) {
  const queryClient = useQueryClient();
  const fn = useServerFn(changeRole);
  const m = useMutation({
    mutationFn: (role: Role) => fn({ data: { id: person.id, role } }),
    onSuccess: async (_r, role) => {
      toast.success(`${person.name} is now ${ROLE_LABEL[role].toLowerCase()}`);
      await queryClient.invalidateQueries({ queryKey: ["people"] });
    },
    onError: (e: Error) => toast.error("Could not change the role", { description: e.message }),
  });

  return (
    <select
      className={FIELD}
      value={person.role}
      disabled={m.isPending}
      aria-label={`Role for ${person.name}`}
      onChange={(e) => m.mutate(e.target.value as Role)}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </select>
  );
}

function AddPersonRow() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [unit, setUnit] = useState("");
  const [role, setRole] = useState<Role>("crm");
  const fn = useServerFn(createPerson);
  const m = useMutation({
    mutationFn: () => fn({ data: { name, email, unit, role } }),
    onSuccess: async () => {
      toast.success(`${name} can now sign in`);
      setName("");
      setEmail("");
      setUnit("");
      await queryClient.invalidateQueries({ queryKey: ["people"] });
    },
    onError: (e: Error) => toast.error("Could not add the person", { description: e.message }),
  });

  return (
    <div className="grid gap-4 border-t border-border-soft px-[18px] py-[18px] sm:grid-cols-5">
      <div>
        <FieldLabel htmlFor="ap-name">Name</FieldLabel>
        <input id="ap-name" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor="ap-email">Work email</FieldLabel>
        <input
          id="ap-email"
          type="email"
          className={FIELD}
          placeholder={`name${WORK_DOMAIN}`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <FieldLabel htmlFor="ap-unit">Business unit</FieldLabel>
        <input id="ap-unit" className={FIELD} value={unit} onChange={(e) => setUnit(e.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor="ap-role">Role</FieldLabel>
        <select
          id="ap-role"
          className={FIELD}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <button
          type="button"
          className={BTN_GHOST}
          disabled={!name.trim() || !email.trim() || m.isPending}
          onClick={() => m.mutate()}
        >
          {m.isPending ? "Adding…" : "Add the person"}
        </button>
      </div>
    </div>
  );
}

function PeoplePage() {
  const fn = useServerFn(listPeople);
  const { data, isPending } = useQuery({
    queryKey: ["people"],
    queryFn: () => fn() as Promise<PersonRow[]>,
  });
  const people = data ?? [];

  return (
    <>
      <AppHeader title="People & roles" />
      <Page>
        <Card>
          <CardHead
            title="Who has access"
            count={people.length}
            eyebrow={`Only ${WORK_DOMAIN} addresses can sign in`}
          />
          {isPending ? (
            <div className="px-[18px] py-[34px] text-center text-[13px] text-muted-foreground">
              Loading the directory…
            </div>
          ) : people.length === 0 ? (
            <Empty title="Nobody has access yet" note="Add the first person below." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
                <thead>
                  <tr>
                    <Th>Person</Th>
                    <Th className="w-[210px]">Business unit</Th>
                    <Th className="w-[150px]">Last active</Th>
                    <Th className="w-[220px]">Role</Th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-[#F7F8F8]">
                      <Td>
                        <span className="text-[14px] font-semibold tracking-[-0.005em]">
                          {p.name}
                        </span>
                        <span className="mt-[1px] block text-[11.5px] text-muted-foreground">
                          {p.email}
                        </span>
                      </Td>
                      <Td className="text-[13px] text-ink-2">{p.unit}</Td>
                      <Td className="figure text-[12px] text-muted-foreground">{p.last_active}</Td>
                      <Td>
                        <RoleSelect person={p} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <AddPersonRow />
        </Card>

        <Card>
          <CardHead title="What each role sees" eyebrow="Access model" />
          <ul className="px-[18px] py-[6px]">
            {ROLES.map((r) => (
              <li key={r} className="border-b border-border-soft py-3.5 last:border-0">
                <span className="eyebrow block">{ROLE_LABEL[r]}</span>
                <p className="mt-1.5 max-w-[86ch] text-[13.5px] leading-[1.55] text-ink-2">
                  {ROLE_SCOPE[r]}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </Page>
    </>
  );
}
