"use client";

import { Send } from "lucide-react";
import { useActionState, useState } from "react";
import { LivePrecheck } from "@/components/live-precheck";
import { FieldError, FieldHint, Label, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Channel, Finding, ProductLine } from "@/domain/types";
import { fieldError, IDLE, submittedValue } from "@/lib/form-state";
import { LIMITS } from "@/lib/validation";
import { resubmitAction } from "@/server/actions/submissions";

export function ResubmitForm({
  reference,
  currentBody,
  currentVersion,
  currentFindings,
  productLine,
  channel,
}: {
  reference: string;
  currentBody: string;
  currentVersion: number;
  currentFindings: Finding[];
  productLine: ProductLine;
  channel: Channel;
}) {
  const [state, formAction] = useActionState(resubmitAction, IDLE);
  const [body, setBody] = useState(submittedValue(state, "body") ?? currentBody);
  const bodyError = fieldError(state, "body");
  const noteError = fieldError(state, "note");

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(25rem,32%)]">
      <form action={formAction} noValidate className="space-y-5 rounded-xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <input type="hidden" name="reference" value={reference} />
        <FormMessage state={state.status === "error" && (bodyError || noteError) ? IDLE : state} />

        <div className="space-y-1.5">
          <Label htmlFor="body">Revised copy (becomes v{currentVersion + 1})</Label>
          <Textarea
            id="body"
            name="body"
            rows={16}
            required
            maxLength={LIMITS.bodyMax}
            defaultValue={submittedValue(state, "body") ?? currentBody}
            onChange={(e) => setBody(e.target.value)}
            aria-invalid={Boolean(bodyError)}
            aria-describedby={bodyError ? "body-error" : undefined}
            className="min-h-80 resize-y font-serif text-[1.0625rem] leading-[1.7]"
          />
          <FieldError id="body-error" message={bodyError} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="note">Note to the reviewer (optional)</Label>
          <Textarea
            id="note"
            name="note"
            rows={3}
            maxLength={LIMITS.commentMax}
            defaultValue={submittedValue(state, "note")}
            placeholder="What you changed, and anything you pushed back on."
            aria-invalid={Boolean(noteError)}
            aria-describedby={["note-hint", noteError ? "note-error" : null].filter(Boolean).join(" ")}
            className="text-sm"
          />
          <FieldHint id="note-hint">Shown under the new version and kept on the audit trail.</FieldHint>
          <FieldError id="note-error" message={noteError} />
        </div>

        <div className="flex justify-end border-t border-line pt-4">
          <SubmitButton variant="brand" pendingLabel="Resubmitting…">
            <Send aria-hidden="true" />
            Resubmit as v{currentVersion + 1}
          </SubmitButton>
        </div>
      </form>

      <LivePrecheck
        text={body}
        productLine={productLine}
        channel={channel}
        previousFindings={currentFindings}
        previousVersion={currentVersion}
        className="xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:overflow-y-auto xl:scrollbar-thin"
      />
    </div>
  );
}
