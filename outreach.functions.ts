import { createServerFn } from "@tanstack/react-start";
import type { OutreachChannel } from "./outreach.server";

export const draftOutreach = createServerFn({ method: "POST" })
  .inputValidator((data: { companyId: string; channel?: OutreachChannel; force?: boolean }) => data)
  .handler(async ({ data }) => {
    const { generateOutreachDraft } = await import("./outreach.server");
    return await generateOutreachDraft(data);
  });

export const saveOutreach = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      companyId: string;
      channel: string;
      contactName: string | null;
      subject: string;
      body: string;
      collateralId: string | null;
      createdBy: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { saveOutreachDraft } = await import("./outreach.server");
    return await saveOutreachDraft(data);
  });

export const updateOutreachStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: string }) => data)
  .handler(async ({ data }) => {
    const { setOutreachStatus } = await import("./outreach.server");
    return await setOutreachStatus(data);
  });

export const removeOutreachDraft = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { deleteOutreachDraft } = await import("./outreach.server");
    return await deleteOutreachDraft(data.id);
  });
