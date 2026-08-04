import { createServerFn } from "@tanstack/react-start";

export const generateHandoff = createServerFn({ method: "POST" })
  .inputValidator((data: { companyId: string; force?: boolean }) => data)
  .handler(async ({ data }) => {
    const { generateHandoffDraft } = await import("./handoff.server");
    return await generateHandoffDraft(data.companyId, data.force ?? false);
  });

export const logHandoff = createServerFn({ method: "POST" })
  .inputValidator((data: { companyId: string; subject: string; body: string }) => data)
  .handler(async ({ data }) => {
    const { logHandoffAsSent } = await import("./handoff.server");
    return await logHandoffAsSent(data);
  });

export const getCosEmail = createServerFn({ method: "GET" }).handler(async () => {
  const { getChiefOfStaffEmail } = await import("./handoff.server");
  return await getChiefOfStaffEmail();
});

export const setCosEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const { setChiefOfStaffEmail } = await import("./handoff.server");
    return await setChiefOfStaffEmail(data.email);
  });
