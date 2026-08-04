import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  Newspaper,
  Target,
  ListChecks,
  Settings,
  Users,
  MessageSquare,
  ClipboardList,
  FolderOpen,
} from "lucide-react";

/** Roles in the prototype. Nav and page access are derived from these. */
export type Role = "ceo" | "cos" | "vp" | "crm" | "admin";

export const ROLE_LABEL: Record<Role, string> = {
  ceo: "CEO",
  crm: "Client relationship manager",
  vp: "VP",
  cos: "Chief of staff",
  admin: "Super admin",
};

export type CockpitUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  unit: string;
  last: string;
  /** Matches the name in the crms table, so ownership filtering works. */
  crmName?: string;
};

/** Seeded directory — the only addresses that can sign in. */
export const USERS: CockpitUser[] = [
  {
    id: "u1",
    name: "Ishwari Sardesai",
    email: "ishwari@programming.com",
    role: "ceo",
    unit: "Executive",
    last: "Today, 06:12",
  },
  {
    id: "u2",
    name: "Priya Raghunathan",
    email: "priya@programming.com",
    role: "crm",
    unit: "Sales — East",
    last: "Today, 08:40",
    crmName: "Priya Raghunathan",
  },
  {
    id: "u3",
    name: "Devika Menon",
    email: "devika@programming.com",
    role: "admin",
    unit: "Operations",
    last: "Today, 07:55",
  },
  {
    id: "u4",
    name: "Marcus Oyelaran",
    email: "marcus@programming.com",
    role: "crm",
    unit: "Sales — West",
    last: "Yesterday, 18:20",
    crmName: "Marcus Oyelaran",
  },
  {
    id: "u5",
    name: "Dana Whitfield",
    email: "dana@programming.com",
    role: "crm",
    unit: "Partnerships",
    last: "2 days ago",
    crmName: "Dana Whitfield",
  },
  {
    id: "u6",
    name: "Tom Bidwell",
    email: "tom@programming.com",
    role: "vp",
    unit: "Delivery",
    last: "Today, 09:02",
  },
  {
    id: "u7",
    name: "Rhea Kapoor",
    email: "rhea@programming.com",
    role: "cos",
    unit: "Executive",
    last: "Today, 08:05",
  },
];

export const WORK_DOMAIN = "@programming.com";

export function findUserByEmail(email: string) {
  return USERS.find((u) => u.email === email.trim().toLowerCase());
}

export function initialsOf(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

export type NavItem = { to: string; label: string; icon: LucideIcon; count?: number };

/** Simulated badge counts for the prototype shell. */
export const NAV_COUNTS = { openActions: 4, unreadFromCeo: 2 };

const DASHBOARD: NavItem = { to: "/", label: "Dashboard", icon: LayoutGrid };
const NEWS: NavItem = { to: "/news", label: "News", icon: Newspaper };
const ACTIONS: NavItem = {
  to: "/actions",
  label: "Actions",
  icon: ListChecks,
  count: NAV_COUNTS.openActions,
};
const COLLATERAL: NavItem = { to: "/collateral", label: "Collateral", icon: FolderOpen };
const SETTINGS: NavItem = { to: "/settings", label: "Settings", icon: Settings };

export function navFor(role: Role): { label: string; items: NavItem[] } {
  if (role === "crm") {
    return {
      label: "My work",
      items: [
        DASHBOARD,
        {
          to: "/messages",
          label: "From the CEO",
          icon: MessageSquare,
          count: NAV_COUNTS.unreadFromCeo,
        },
        { to: "/log-activity", label: "Log activity", icon: ClipboardList },
        { to: "/leads", label: "My accounts", icon: Target },
        NEWS,
        COLLATERAL,
        ACTIONS,
      ],
    };
  }

  const base: NavItem[] = [
    DASHBOARD,
    NEWS,
    { to: "/leads", label: "Leads", icon: Target },
    COLLATERAL,
    ACTIONS,
  ];

  // A super admin manages people and configuration — never lead data.
  if (role === "admin") {
    return {
      label: "Administration",
      items: [{ to: "/people", label: "People & roles", icon: Users }, SETTINGS],
    };
  }

  return { label: "Briefing", items: [...base, SETTINGS] };
}

/** Where each role lands after signing in. */
export function landingFor(role: Role) {
  return role === "admin" ? "/people" : "/";
}
