"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import type { FormState } from "@/lib/form-state";
import { personaSchema, safeNextPath } from "@/lib/validation";
import { recordAudit } from "../audit";
import { getCurrentUser, homePathFor } from "../auth";
import { UserFacingError } from "../errors";
import { formValues, guardSignIn, parse, runAction } from "../guard";
import { endSession, startSession } from "../session";

/**
 * Demo sign-in: pick a persona, get a session. See `src/server/session.ts`
 * for why this is acceptable here and what replaces it in production.
 * Also used by the sidebar's persona switcher.
 */
export async function signInAs(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  return runAction(async () => {
    await guardSignIn();
    const { userId } = parse(personaSchema, values);
    const db = getDb();
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, title: users.title, team: users.team })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new UserFacingError("That demo user doesn't exist.");

    const previous = await getCurrentUser();
    if (previous && previous.id !== user.id) {
      await recordAudit(db, previous, {
        action: "session.signed_out",
        summary: `${previous.name} switched to ${user.name}`,
      });
    }
    const session = await startSession(user.id);
    await recordAudit(db, { ...user, sessionId: session.sessionId }, {
      action: "session.signed_in",
      summary: `${user.name} signed in to the demo`,
    });

    redirect(safeNextPath(values.next) ?? homePathFor(user.role));
  }, values);
}

export async function signOut(): Promise<void> {
  await runAction(async () => {
    await guardSignIn();
    const user = await getCurrentUser();
    if (user) {
      await recordAudit(getDb(), user, { action: "session.signed_out", summary: `${user.name} signed out` });
    }
    await endSession();
    redirect("/login");
  });
}
