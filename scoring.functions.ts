import { createServerFn } from "@tanstack/react-start";

export const runScoringNow = createServerFn({ method: "POST" }).handler(async () => {
  const { executeScoringRun } = await import("./scoring-run.server");
  return await executeScoringRun();
});
