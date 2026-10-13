"use client";

import { MessageSquare } from "lucide-react";
import { useActionState } from "react";
import { FieldError, Label, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { fieldError, IDLE, submittedValue } from "@/lib/form-state";
import { LIMITS } from "@/lib/validation";
import { addCommentAction } from "@/server/actions/submissions";

/** React clears the textarea after a successful post; errors echo the text back. */
export function CommentForm({ reference, version }: { reference: string; version: number }) {
  const [state, formAction] = useActionState(addCommentAction, IDLE);
  const error = fieldError(state, "body") ?? (state.status === "error" ? state.message : undefined);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="reference" value={reference} />
      <Label htmlFor="comment-body" className="sr-only">
        Add a comment on v{version}
      </Label>
      <Textarea
        id="comment-body"
        name="body"
        rows={3}
        required
        maxLength={LIMITS.commentMax}
        defaultValue={submittedValue(state, "body")}
        placeholder={`Comment on v${version}…`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "comment-error" : undefined}
        className="text-sm"
      />
      <div className="flex items-center justify-between gap-3">
        <div aria-live="polite" className="min-w-0">
          <FieldError id="comment-error" message={error} />
          {state.status === "success" ? <p className="text-[0.8125rem] text-approve-700">{state.message}</p> : null}
        </div>
        <SubmitButton variant="secondary" size="sm" pendingLabel="Posting…">
          <MessageSquare aria-hidden="true" />
          Post comment
        </SubmitButton>
      </div>
    </form>
  );
}
