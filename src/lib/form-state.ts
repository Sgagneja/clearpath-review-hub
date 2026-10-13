/**
 * What a server action hands back to the form that called it. Shared by the
 * actions and the client components, so it lives outside `src/server`.
 */
export type FormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string>;
      /** Echoed back so React's post-action form reset doesn't wipe the user's input. */
      values?: Record<string, string>;
    };

export const IDLE: FormState = { status: "idle" };

export function fieldError(state: FormState, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field] : undefined;
}

export function submittedValue(state: FormState, field: string): string | undefined {
  return state.status === "error" ? state.values?.[field] : undefined;
}
