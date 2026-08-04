import { createServerFn } from "@tanstack/react-start";

export const getNews = createServerFn({ method: "GET" }).handler(async () => {
  const { getNewsData } = await import("./news.server");
  return await getNewsData();
});

export const dismissNewsItem = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; reason: string }) => data)
  .handler(async ({ data }) => {
    const { dismissNews } = await import("./news.server");
    return await dismissNews(data.id, data.reason);
  });

export const applyRelevanceFloor = createServerFn({ method: "POST" })
  .inputValidator((data: { value: number }) => data)
  .handler(async ({ data }) => {
    const { setMinRelevance } = await import("./news.server");
    return await setMinRelevance(data.value);
  });
