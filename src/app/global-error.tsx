"use client";

import "./globals.css";
import { useEffect } from "react";

/**
 * Last line of defence: replaces the root layout when it fails, so it brings
 * its own document and keeps to plain markup with no app components.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-paper font-sans text-ink-900 antialiased">
        <title>Something went wrong · ClearPath Review Hub</title>
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
          <p className="text-sm font-semibold text-brand-700">ClearPath Review Hub</p>
          <h1 className="page-title mt-6">Review Hub didn&apos;t load</h1>
          <p className="mt-2 text-ink-600">Something went wrong on our side. Nothing you entered was lost or half-saved.</p>
          {error.digest ? (
            <p className="mt-2 text-sm text-ink-500">
              If it keeps happening, quote reference <span className="font-mono text-ink-700">{error.digest}</span>.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => retry()}
            className="mt-6 self-start rounded-md border border-line-strong bg-white px-3.5 py-2 text-sm font-medium text-ink-900 hover:bg-paper"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
