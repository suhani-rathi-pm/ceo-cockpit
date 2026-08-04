import { createServerFn } from "@tanstack/react-start";

export const getCollateralStore = createServerFn({ method: "GET" }).handler(async () => {
  const { getCollateral } = await import("./collateral.server");
  return await getCollateral();
});
