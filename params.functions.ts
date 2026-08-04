import { createServerFn } from "@tanstack/react-start";
import type { RuntimeParams } from "./params";

export const getParams = createServerFn({ method: "GET" }).handler(async () => {
  const { loadParams } = await import("./params.server");
  return await loadParams();
});

export const updateParams = createServerFn({ method: "POST" })
  .inputValidator((data: { params: RuntimeParams }) => data)
  .handler(async ({ data }) => {
    const { saveParams } = await import("./params.server");
    return await saveParams(data.params);
  });

export const restoreDefaultParams = createServerFn({ method: "POST" }).handler(async () => {
  const { resetParams } = await import("./params.server");
  return await resetParams();
});
