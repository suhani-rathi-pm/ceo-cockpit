import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { WORK_DOMAIN, type Role } from "./roles";

/** The access directory. Super admins manage people here — and nothing else. */

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export interface PersonRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  unit: string;
  last_active: string;
}

const ROLE_ORDER: Role[] = ["ceo", "cos", "vp", "crm", "admin"];

export async function getPeople(): Promise<PersonRow[]> {
  const db = serverClient();
  const res = await db.from("people").select("id,name,email,role,unit,last_active");
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? [])
    .map((p) => ({ ...p, role: p.role as Role }))
    .sort(
      (a, b) =>
        ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name),
    );
}

export async function setPersonRole(input: { id: string; role: Role }) {
  const db = serverClient();
  const res = await db.from("people").update({ role: input.role }).eq("id", input.id);
  if (res.error) throw new Error(res.error.message);
  return { ok: true as const };
}

export async function addPerson(input: {
  name: string;
  email: string;
  unit: string;
  role: Role;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email.endsWith(WORK_DOMAIN)) {
    throw new Error(`Cockpit only accepts ${WORK_DOMAIN} addresses.`);
  }
  if (!input.name.trim()) throw new Error("Give the person a name.");

  const db = serverClient();
  const res = await db.from("people").insert({
    name: input.name.trim(),
    email,
    unit: input.unit.trim() || "Unassigned",
    role: input.role,
    last_active: "Not yet signed in",
  });
  if (res.error) throw new Error(res.error.message);
  return { ok: true as const };
}
