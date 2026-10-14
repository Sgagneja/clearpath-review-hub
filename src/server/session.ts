import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  sessionKey,
  signSession,
  verifySession,
  type Session,
} from "@/lib/auth/session-token";

/*
 * ── Demo authentication: read this before trusting it ──────────────────────
 *
 * There are no passwords. The login page lets anyone pick one of seven
 * fictional personas and hands out a signed session cookie for that user.
 * That is a deliberate trade-off for a public demo: someone evaluating the app
 * should see all three roles in under a minute without creating accounts.
 *
 * What is real, and stays the same in production:
 *   - The cookie is an HS256-signed JWT (algorithm pinned, issuer/audience
 *     checked), HttpOnly, SameSite=Lax, Secure + `__Host-` in production, and
 *     expires after 8 hours. Forged or expired cookies are ignored.
 *   - The cookie only names the user. Their role is read from the database on
 *     every request (see `getCurrentUser`), and every read and mutation goes
 *     through the policy in `src/domain/permissions.ts`.
 *   - Sign-ins, sign-outs and persona switches land in the audit trail with a
 *     session id, so every action can be traced back to a session.
 *
 * What a production deployment changes:
 *   - `startSession` is called by an OIDC callback (authorization code + PKCE)
 *     against ClearPath's identity provider, e.g. Okta or Entra ID, instead of
 *     by a persona picker. MFA and offboarding come from the IdP, and roles map
 *     from IdP groups. Only this file and the login page change; the policy,
 *     data layer and audit trail just need an actor id and a role.
 *   - Sessions are stored server-side (or checked against a deny list) so they
 *     can be revoked before they expire, and SESSION_SECRET is rotated through
 *     the secret manager.
 */

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export async function startSession(userId: string): Promise<Session> {
  const { token, session } = await signSession(userId, sessionKey());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { ...COOKIE_OPTIONS, maxAge: SESSION_TTL_SECONDS });
  return session;
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  // Browsers ignore a `__Host-` cookie that isn't Secure, including the expired
  // one that clears it, so it has to be cleared with the attributes it was set with.
  store.set(SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

/** The verified session for this request, or null. Cached per request. */
export const readSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value, sessionKey());
});
