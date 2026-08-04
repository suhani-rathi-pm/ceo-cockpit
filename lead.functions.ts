import { createServerFn } from "@tanstack/react-start";
import type { CompanyState } from "./scoring";

export const getLead = createServerFn({ method: "GET" })
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data }) => {
    const { getLeadDetail } = await import("./lead.server");
    return await getLeadDetail(data.companyId);
  });

export const correctClassification = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { companyId: string; toState: CompanyState; actor: string; reason: string }) => data,
  )
  .handler(async ({ data }) => {
    const { correctLeadClassification } = await import("./lead.server");
    return await correctLeadClassification(data);
  });

export const createAction = createServerFn({ method: "POST" })
  .inputValidator((data: { companyId: string; routedTo: string; note: string }) => data)
  .handler(async ({ data }) => {
    const { createLeadAction } = await import("./lead.server");
    return await createLeadAction(data);
  });
