/**
 * HTTP security headers. The CSP is built per request in `src/proxy.ts`
 * (it carries a fresh nonce); the static headers are applied to every
 * response, static assets included, from `next.config.ts`.
 */

/**
 * Strict, nonce-based CSP. `'strict-dynamic'` lets Next's nonced bootstrap
 * script load its chunks while ignoring any host allow-list, so an injected
 * <script> without the nonce never runs.
 *
 * `style-src` allows inline styles: the dashboard's bar widths are style
 * attributes, which nonces can't cover. Adding a nonce here would also make
 * browsers ignore 'unsafe-inline'. CSS injection is a much smaller risk than
 * script injection, and scripts stay locked down.
 */
export function buildCsp({ nonce, isDev }: { nonce: string; isDev: boolean }): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React needs eval in development only, to rebuild server error stacks.
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** 128 bits from the platform CSPRNG, base64-encoded. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  // Two years, all subdomains. Not "preload": that needs a domain we own.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];
