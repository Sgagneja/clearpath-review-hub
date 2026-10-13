import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Every page in this app is personalised (session cookie + per-request CSP
  // nonce), so we render dynamically and deliberately leave Cache Components
  // and Partial Prefetching off. Nonce-based CSP is incompatible with a
  // prerendered static shell.
  poweredByHeader: false,
  // postgres.js opens raw TCP sockets; keep it out of the server bundle.
  serverExternalPackages: ["postgres"],
  experimental: {
    // Tracker uploads are capped at 2 MB (src/lib/spreadsheet); this leaves
    // room for the form's own overhead and nothing more.
    serverActions: { bodySizeLimit: "2.5mb" },
  },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  // The per-request CSP comes from src/proxy.ts; these apply to everything.
  async headers() {
    return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }];
  },
};

export default nextConfig;
