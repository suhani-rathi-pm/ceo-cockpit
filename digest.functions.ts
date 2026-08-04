import { createServerFn } from "@tanstack/react-start";
import { buildDigestScript } from "./digest.server";

export const getDigest = createServerFn({ method: "GET" }).handler(() => buildDigestScript());
