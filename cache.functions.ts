import { createServerFn } from "@tanstack/react-start";

export const getCache = createServerFn({ method: "GET" }).handler(async () => {
  const { getCacheStats } = await import("./cache.server");
  return await getCacheStats();
});

export const clearCache = createServerFn({ method: "POST" })
  .inputValidator((data: { kind?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const { clearGenerationCache } = await import("./cache.server");
    return await clearGenerationCache(data.kind);
  });
