"use client";

import { unstable_rethrow } from "next/navigation";
import { useActionState } from "react";
import type { FormState } from "./form-state";

const OFFLINE = "You seem to be offline, so nothing was saved. Reconnect and try again.";
const UNREACHABLE = "We couldn't reach Review Hub, so nothing was saved. Check your connection and try again in a moment.";

function typedValues(data: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of data.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}

/**
 * `useActionState` with a safety net. Server actions already turn every
 * expected failure into a message, but a request can also fail before it
 * reaches them (offline, a dropped connection, a body the server refuses).
 * Those would otherwise replace the page with the error screen and lose what
 * was typed; here they become an inline message and the input is kept.
 * Next's own redirects travel as thrown errors and are passed through.
 */
export function useFormAction<S extends { status: string } = FormState>(
  action: (prev: S | FormState, data: FormData) => Promise<S | FormState>,
  initial: S | FormState,
) {
  type State = S | FormState;
  return useActionState<State, FormData>(
    async (prev, data) => {
      try {
        return await action(prev as State, data);
      } catch (error) {
        unstable_rethrow(error);
        console.error("[form] request failed", error);
        const message = typeof navigator !== "undefined" && navigator.onLine === false ? OFFLINE : UNREACHABLE;
        return { status: "error", message, values: typedValues(data) };
      }
    },
    initial as Awaited<State>,
  );
}
