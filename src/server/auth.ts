import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import type { Actor } from "@/domain/permissions";
import type { Role } from "@/domain/types";
import { readSession } from "./session";

/** The signed-in user, as the rest of the server sees them. */
export interface CurrentUser extends Actor {
  name: string;
  email: string;
  title: string;
  team: string;
  sessionId: string;
}

/**
 * Resolves the session cookie to a user row. The role always comes from the
 * database, never from the cookie, so changing someone's role takes effect on
 * their next request. Cached per request, so layouts and pages can both call it.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;

  const [user] = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      title: users.title,
      team: users.team,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return user ? { ...user, sessionId: session.sessionId } : null;
});

/** For pages: the current user, or a redirect to the login page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Where each role lands after signing in. */
export function homePathFor(role: Role): "/queue" | "/dashboard" {
  return role === "compliance_lead" ? "/dashboard" : "/queue";
}
