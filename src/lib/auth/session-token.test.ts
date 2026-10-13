import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { sessionKey, signSession, SESSION_TTL_SECONDS, verifySession } from "./session-token";

const key = sessionKey("a-test-secret-that-is-comfortably-over-32-chars");
const otherKey = sessionKey("a-different-secret-that-is-also-over-32-chars");

describe("sessionKey", () => {
  it("rejects a missing or short secret", () => {
    expect(() => sessionKey("")).toThrow(/SESSION_SECRET/);
    expect(() => sessionKey("short")).toThrow(/at least 32/);
  });

  it("reads SESSION_SECRET from the environment by default", () => {
    expect(sessionKey()).toBeInstanceOf(Uint8Array);
  });
});

describe("signSession / verifySession", () => {
  it("round-trips the user and session id", async () => {
    const { token, session } = await signSession("u_dana", key);
    expect(await verifySession(token, key)).toEqual(session);
    expect(session.sessionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("expires after the TTL", async () => {
    const issued = new Date("2026-10-12T09:00:00Z");
    const { token } = await signSession("u_dana", key, issued);
    const justBefore = new Date(issued.getTime() + (SESSION_TTL_SECONDS - 60) * 1000);
    const after = new Date(issued.getTime() + (SESSION_TTL_SECONDS + 60) * 1000);
    expect(await verifySession(token, key, justBefore)).not.toBeNull();
    expect(await verifySession(token, key, after)).toBeNull();
  });

  it("rejects a token signed with a different key", async () => {
    const { token } = await signSession("u_dana", otherKey);
    expect(await verifySession(token, key)).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const { token } = await signSession("u_priya", key);
    const [header, , signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "u_dana" })).toString("base64url");
    expect(await verifySession(`${header}.${forged}.${signature}`, key)).toBeNull();
  });

  it("rejects an unsigned (alg: none) token", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "u_dana", jti: "x", exp: 9_999_999_999 })).toString("base64url");
    expect(await verifySession(`${header}.${payload}.`, key)).toBeNull();
  });

  it("rejects a valid signature with the wrong audience", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u_dana")
      .setJti("x")
      .setIssuer("clearpath-review-hub")
      .setAudience("some-other-app")
      .setExpirationTime("1h")
      .sign(key);
    expect(await verifySession(token, key)).toBeNull();
  });

  it("returns null for garbage and missing tokens", async () => {
    expect(await verifySession("not-a-jwt", key)).toBeNull();
    expect(await verifySession(undefined, key)).toBeNull();
  });
});
