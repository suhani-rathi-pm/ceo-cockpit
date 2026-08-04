import { createServerFn } from "@tanstack/react-start";
import type { Role } from "./roles";

export const listPeople = createServerFn({ method: "GET" }).handler(async () => {
  const { getPeople } = await import("./people.server");
  return await getPeople();
});

export const changeRole = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; role: Role }) => data)
  .handler(async ({ data }) => {
    const { setPersonRole } = await import("./people.server");
    return await setPersonRole(data);
  });

export const createPerson = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; email: string; unit: string; role: Role }) => data)
  .handler(async ({ data }) => {
    const { addPerson } = await import("./people.server");
    return await addPerson(data);
  });
