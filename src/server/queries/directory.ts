import "server-only";
import { asc } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import type { Role } from "@/domain/types";

/** Public profile of a user: what any signed-in user may see about another. */
export interface Person {
  id: string;
  name: string;
  role: Role;
  title: string;
  team: string;
}

const ROLE_ORDER: Record<Role, number> = { submitter: 0, reviewer: 1, compliance_lead: 2 };

/**
 * The (small) company directory, loaded once per request and used to resolve
 * ids to names. Emails are left out on purpose: nothing on screen needs them.
 */
export const getDirectory = cache(async () => {
  const rows = await getDb()
    .select({ id: users.id, name: users.name, role: users.role, title: users.title, team: users.team })
    .from(users)
    .orderBy(asc(users.name));
  const people: Person[] = rows.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const byId = new Map(people.map((p) => [p.id, p]));
  return {
    people,
    get: (id: string | null | undefined): Person | null => (id ? (byId.get(id) ?? null) : null),
  };
});
