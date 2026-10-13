"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-xl py-6">
      <h1 className="page-title">This page didn&apos;t load</h1>
      <p className="mt-2 text-ink-600">Something went wrong on our side. Nothing you entered was lost or half-saved.</p>
      {error.digest ? (
        <p className="mt-2 text-sm text-ink-500">
          If it keeps happening, quote reference <span className="font-mono text-ink-700">{error.digest}</span>.
        </p>
      ) : null}
      <Button variant="secondary" className="mt-6" onClick={() => retry()}>
        <RotateCcw aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
