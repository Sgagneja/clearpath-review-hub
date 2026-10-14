import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  title: {
    default: "ClearPath Review Hub",
    template: "%s · ClearPath Review Hub",
  },
  description:
    "Marketing compliance review for ClearPath Financial: an instant pre-check, review deadlines set by risk, and an audit trail nobody can edit.",
  // An internal tool, even as a public demo: keep it out of search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#08152a",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // A page built ahead of time has no CSP nonce, so the browser blocks its scripts.
  // Waiting for the request renders every page, "not found" included, per request.
  await connection();
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
