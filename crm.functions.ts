import { createServerFn } from "@tanstack/react-start";
import type { ActivitySubmission } from "./crm.server";

export const getCrmDashboard = createServerFn({ method: "GET" })
  .inputValidator((data: { crmName: string }) => data)
  .handler(async ({ data }) => {
    const { getCrmDashboardData } = await import("./crm.server");
    return await getCrmDashboardData(data.crmName);
  });

export const getMessages = createServerFn({ method: "GET" })
  .inputValidator((data: { crmName: string }) => data)
  .handler(async ({ data }) => {
    const { getCrmMessages } = await import("./crm.server");
    return await getCrmMessages(data.crmName);
  });

export const markRead = createServerFn({ method: "POST" })
  .inputValidator((data: { messageId: string }) => data)
  .handler(async ({ data }) => {
    const { markMessageRead } = await import("./crm.server");
    return await markMessageRead(data.messageId);
  });

export const sendReply = createServerFn({ method: "POST" })
  .inputValidator((data: { messageId: string; author: string; body: string }) => data)
  .handler(async ({ data }) => {
    const { replyToMessage } = await import("./crm.server");
    return await replyToMessage(data);
  });

export const getAccounts = createServerFn({ method: "GET" })
  .inputValidator((data: { crmName: string }) => data)
  .handler(async ({ data }) => {
    const { getAccountOptions } = await import("./crm.server");
    return await getAccountOptions(data.crmName);
  });

export const logActivity = createServerFn({ method: "POST" })
  .inputValidator((data: ActivitySubmission) => data)
  .handler(async ({ data }) => {
    const { submitActivity } = await import("./crm.server");
    return await submitActivity(data);
  });

export const reviseSize = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { companyId: string; actor: string; newSize: string; whatChanged: string }) => data,
  )
  .handler(async ({ data }) => {
    const { reviseOpportunity } = await import("./crm.server");
    return await reviseOpportunity(data);
  });

export const flagUp = createServerFn({ method: "POST" })
  .inputValidator((data: { companyId: string; actor: string; body: string }) => data)
  .handler(async ({ data }) => {
    const { flagForCeo } = await import("./crm.server");
    return await flagForCeo(data);
  });

export const askForCollateral = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      companyId: string;
      actor: string;
      item: string;
      neededBy: string;
      note: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { requestCollateral } = await import("./crm.server");
    return await requestCollateral(data);
  });

export const markInactive = createServerFn({ method: "POST" })
  .inputValidator((data: { companyId: string; actor: string; reason: string }) => data)
  .handler(async ({ data }) => {
    const { markAccountInactive } = await import("./crm.server");
    return await markAccountInactive(data);
  });
