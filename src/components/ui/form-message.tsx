"use client";

import { cn } from "@/lib/cn";
import type { FormState } from "@/lib/form-state";
import { Notice } from "./notice";

/**
 * Announces an action's outcome. The live region is always rendered (empty
 * when idle) so screen readers pick up the change when a message appears;
 * `empty:mb-0` stops the empty region from adding a gap inside `space-y-*`.
 */
export function FormMessage({ state, className }: { state: FormState; className?: string }) {
  return (
    <div aria-live="polite" className={cn("empty:mb-0", className)}>
      {state.status === "error" ? (
        <Notice tone="error" role="alert">
          {state.message}
        </Notice>
      ) : state.status === "success" ? (
        <Notice tone="success">{state.message}</Notice>
      ) : null}
    </div>
  );
}
