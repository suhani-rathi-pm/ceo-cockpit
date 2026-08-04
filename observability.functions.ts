import { createServerFn } from "@tanstack/react-start";

export const getObservabilityData = createServerFn({ method: "GET" }).handler(async () => {
  const { getObservability } = await import("./observability.server");
  return await getObservability();
});
