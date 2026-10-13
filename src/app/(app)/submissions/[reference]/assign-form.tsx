"use client";

import { useActionState } from "react";
import { FieldError, Label, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { fieldError, IDLE, submittedValue } from "@/lib/form-state";
import { assignReviewerAction } from "@/server/actions/submissions";

export function AssignForm({
  reference,
  currentAssigneeId,
  reviewers,
}: {
  reference: string;
  currentAssigneeId: string | null;
  reviewers: { id: string; name: string; openCount: number; title: string }[];
}) {
  const [state, formAction] = useActionState(assignReviewerAction, IDLE);
  const error = fieldError(state, "assigneeId");
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="reference" value={reference} />
      <Label htmlFor="assigneeId">{currentAssigneeId ? "Reassign reviewer" : "Assign a reviewer"}</Label>
      <div className="flex gap-2">
        <Select
          id="assigneeId"
          name="assigneeId"
          defaultValue={submittedValue(state, "assigneeId") ?? currentAssigneeId ?? ""}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "assigneeId-error" : undefined}
          className="h-9 flex-1 text-sm"
        >
          <option value="" disabled>
            Choose a reviewer…
          </option>
          {reviewers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · {r.openCount} open
            </option>
          ))}
        </Select>
        <SubmitButton variant="secondary" size="sm" className="h-9" pendingLabel="Saving…">
          Assign
        </SubmitButton>
      </div>
      <FieldError id="assigneeId-error" message={error} />
      {state.status !== "idle" && !error ? <FormMessage state={state} /> : null}
    </form>
  );
}
