import { createServerFn } from "@tanstack/react-start";

export const getLeads = createServerFn({ method: "GET" }).handler(async () => {
  const { getLeadsList } = await import("./leads.server");
  return await getLeadsList();
});
