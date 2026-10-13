import { jwtVerify, SignJWT } from "jose";

/**
 * Signed session token for the demo login.
 *
 * The token is an HS256 JWT holding nothing but the user id and a random
 * session id. It is signed (tamper-proof) but not encrypted, so it must never
 * carry anything sensitive. The role is deliberately *not* in the token: it is
 * read from the database on every request, so a role change takes effect
 * immediately and a stale token can't grant old privileges.
 */

/**
 * In production the `__Host-` prefix makes the browser refuse the cookie
 * unless it is Secure, host-only and scoped to `/`, so a sibling subdomain
 * can't plant or overwrite it. Plain http://localhost can't satisfy that.
 */
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-cp_session" : "cp_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const ISSUER = "clearpath-review-hub";
const AUDIENCE = "clearpath-review-hub:web";
const MIN_SECRET_LENGTH = 32;

export interface Session {
  userId: string;
  sessionId: string;
  expiresAt: Date;
}

export function sessionKey(secret: string | undefined = process.env.SESSION_SECRET): Uint8Array {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters (try: openssl rand -base64 48).`,
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  userId: string,
  key: Uint8Array,
  now: Date = new Date(),
): Promise<{ token: string; session: Session }> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const session: Session = {
    userId,
    sessionId: crypto.randomUUID(),
    expiresAt: new Date((issuedAt + SESSION_TTL_SECONDS) * 1000),
  };
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setJti(session.sessionId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_TTL_SECONDS)
    .sign(key);
  return { token, session };
}

/** Returns the session, or null for any invalid, expired or forged token. */
export async function verifySession(
  token: string | undefined,
  key: Uint8Array,
  now: Date = new Date(),
): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      // Pinning the algorithm blocks "alg: none" and algorithm-confusion attacks.
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: now,
    });
    if (!payload.sub || !payload.jti || !payload.exp) return null;
    return {
      userId: payload.sub,
      sessionId: payload.jti,
      expiresAt: new Date(payload.exp * 1000),
    };
  } catch {
    return null;
  }
}
