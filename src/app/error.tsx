"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

/** Errors outside the signed-in app, such as on the sign-in page. */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <Logo tone="dark" />
      <h1 className="page-title mt-10">This page didn&apos;t load</h1>
      <p className="mt-2 text-ink-600">Something went wrong on our side. Give it a moment and try again.</p>
      {error.digest ? (
        <p className="mt-2 text-sm text-ink-500">
          If it keeps happening, quote reference <span className="font-mono text-ink-700">{error.digest}</span>.
        </p>
      ) : null}
      <Button variant="secondary" className="mt-6 self-start" onClick={() => retry()}>
        <RotateCcw aria-hidden="true" />
        Try again
      </Button>
    </main>
  );
}
