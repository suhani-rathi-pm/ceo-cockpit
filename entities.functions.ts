import { createServerFn } from "@tanstack/react-start";

export const getEntityQueue = createServerFn({ method: "GET" }).handler(async () => {
  const { getEntityResolution } = await import("./entities.server");
  return await getEntityResolution();
});

export const decideEntityAlias = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id: string;
      action: "confirm" | "reject";
      companyId?: string | null;
      actor: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { decideAlias } = await import("./entities.server");
    return await decideAlias(data);
  });

export const reopenEntityAlias = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { reopenAlias } = await import("./entities.server");
    return await reopenAlias(data.id);
  });
