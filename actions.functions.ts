import { createServerFn } from "@tanstack/react-start";
import type { ActionStatus } from "./actions.server";

export const getActions = createServerFn({ method: "GET" }).handler(async () => {
  const { getActionsData } = await import("./actions.server");
  return await getActionsData();
});

export const updateActionStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { actionId: string; status: ActionStatus }) => data)
  .handler(async ({ data }) => {
    const { setActionStatus } = await import("./actions.server");
    return await setActionStatus(data);
  });

export const messageOwner = createServerFn({ method: "POST" })
  .inputValidator((data: { companyId: string; owner: string; body: string }) => data)
  .handler(async ({ data }) => {
    const { logOwnerMessage } = await import("./actions.server");
    return await logOwnerMessage(data);
  });
