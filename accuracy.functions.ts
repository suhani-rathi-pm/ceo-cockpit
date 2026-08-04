import { createServerFn } from "@tanstack/react-start";

export const getAccuracy = createServerFn({ method: "GET" }).handler(async () => {
  const { getAccuracyData } = await import("./accuracy.server");
  return await getAccuracyData();
});
