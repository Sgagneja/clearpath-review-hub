import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session-token";
import { buildCsp, createNonce } from "@/lib/security-headers";

/**
 * Runs before every page request. It does two cheap things and nothing else:
 *
 *   1. Mints a CSP nonce. Next.js reads it from the request's
 *      Content-Security-Policy header and stamps it on its own scripts.
 *   2. Sends visitors without a session cookie to the login page. This is
 *      only an optimistic redirect for nicer UX: it checks the cookie exists,
 *      not that it's valid. The real check (signature, expiry, user lookup)
 *      happens in `requireUser()` and in every server action.
 */

const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isPublic && !request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/login", request.url);
    const isPageLoad = request.method === "GET";
    // Only page loads are worth returning to; a POST target (e.g. the CSV export) isn't.
    if (isPageLoad && pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    // 303 turns a POST into a GET of the login page instead of re-POSTing to it.
    return NextResponse.redirect(login, isPageLoad ? 307 : 303);
  }

  const nonce = createNonce();
  const csp = buildCsp({ nonce, isDev: process.env.NODE_ENV === "development" });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Everything except build assets and files served from /public.
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
      // Prefetches return RSC payloads, not documents, so they need no nonce.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
