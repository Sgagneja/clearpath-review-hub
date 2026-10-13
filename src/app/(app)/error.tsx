"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-high-50 text-high-600 ring-1 ring-high-200">
        <TriangleAlert className="size-5" aria-hidden="true" />
      </span>
      <h1 className="mt-5 font-serif text-[1.75rem] font-medium text-ink-950">This page didn&apos;t load</h1>
      <p className="mt-2 text-ink-600">Something went wrong on our side. Nothing you entered was lost or half-saved.</p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-ink-400">Reference {error.digest}</p> : null}
      <Button variant="secondary" className="mt-6" onClick={() => retry()}>
        <RotateCcw aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
