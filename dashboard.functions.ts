import { createServerFn } from "@tanstack/react-start";

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { getDashboardData } = await import("./dashboard.server");
  return await getDashboardData();
});
