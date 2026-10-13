import { describe, expect, it } from "vitest";
import { buildCsp, createNonce, STATIC_SECURITY_HEADERS } from "./security-headers";

const directive = (csp: string, name: string) =>
  csp.split("; ").find((d) => d.startsWith(`${name} `));

describe("buildCsp", () => {
  it("locks scripts to the request nonce with strict-dynamic", () => {
    const csp = buildCsp({ nonce: "abc123", isDev: false });
    expect(directive(csp, "script-src")).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
  });

  it("only allows eval in development", () => {
    expect(buildCsp({ nonce: "n", isDev: false })).not.toContain("unsafe-eval");
    expect(directive(buildCsp({ nonce: "n", isDev: true }), "script-src")).toContain("'unsafe-eval'");
  });

  it("never puts a nonce in style-src, which would disable 'unsafe-inline'", () => {
    const style = directive(buildCsp({ nonce: "n", isDev: false }), "style-src");
    expect(style).toBe("style-src 'self' 'unsafe-inline'");
  });

  it("blocks framing, plugins, base-tag hijacking and off-site form posts", () => {
    const csp = buildCsp({ nonce: "n", isDev: false });
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
});

describe("createNonce", () => {
  it("is unique per call and carries 128 bits", () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).not.toBe(b);
    expect(atob(a)).toHaveLength(16);
  });
});

describe("STATIC_SECURITY_HEADERS", () => {
  it("includes the baseline hardening headers", () => {
    const keys = STATIC_SECURITY_HEADERS.map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
  });
});
