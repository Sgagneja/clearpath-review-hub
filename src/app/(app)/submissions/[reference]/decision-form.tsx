"use client";

import { Ban, BadgeCheck, FilePen, type LucideIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { FieldError, FieldHint, Label, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { DECISIONS, type Decision } from "@/domain/types";
import { cn } from "@/lib/cn";
import { fieldError, IDLE, submittedValue } from "@/lib/form-state";
import { pluralize } from "@/lib/format";
import { approvalNeedsRationale, LIMITS } from "@/lib/validation";
import { decideAction } from "@/server/actions/submissions";

const OPTIONS: Record<Decision, { label: string; hint: string; icon: LucideIcon; tone: string; button: "brand" | "warning" | "danger" }> = {
  approve: {
    label: "Approve",
    hint: "Cleared to launch as written",
    icon: BadgeCheck,
    tone: "has-[:checked]:border-approve-500 has-[:checked]:bg-approve-50 has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-approve-500)] [&_svg]:text-approve-600",
    button: "brand",
  },
  request_changes: {
    label: "Request changes",
    hint: "Back to the submitter for a revision",
    icon: FilePen,
    tone: "has-[:checked]:border-medium-500 has-[:checked]:bg-medium-50 has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-medium-500)] [&_svg]:text-medium-600",
    button: "warning",
  },
  reject: {
    label: "Reject",
    hint: "Can't run in any form; closes the submission",
    icon: Ban,
    tone: "has-[:checked]:border-high-500 has-[:checked]:bg-high-50 has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-high-500)] [&_svg]:text-high-600",
    button: "danger",
  },
};

export function DecisionForm({ reference, version, openHighFindings }: { reference: string; version: number; openHighFindings: number }) {
  const [state, formAction] = useActionState(decideAction, IDLE);
  // No default: a compliance decision should be a deliberate choice, not a pre-filled one.
  const [decision, setDecision] = useState<Decision | null>((submittedValue(state, "decision") as Decision | undefined) ?? null);
  const selected = decision ? OPTIONS[decision] : null;
  const error = fieldError(state, "comment");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="reference" value={reference} />
      <fieldset>
        <legend className="text-[0.8125rem] font-medium text-ink-800">Decision on version {version}</legend>
        <div className="mt-2 grid gap-2">
          {DECISIONS.map((d) => {
            const { label, hint, icon: Icon, tone } = OPTIONS[d];
            return (
              <label
                key={d}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border border-line-strong bg-white px-3.5 py-2.5 transition-colors hover:border-ink-300 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand-100",
                  tone,
                )}
              >
                <input
                  type="radio"
                  name="decision"
                  value={d}
                  required
                  defaultChecked={d === decision}
                  onChange={() => setDecision(d)}
                  className="sr-only"
                />
                <Icon className="size-4 shrink-0 text-ink-400" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink-900">{label}</span>
                  <span className="block text-xs text-ink-500">{hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {decision ? (
        <RationaleField decision={decision} openHighFindings={openHighFindings} defaultValue={submittedValue(state, "comment")} error={error} />
      ) : null}

      <FormMessage state={state.status === "error" && error ? IDLE : state} />

      {selected ? (
        <SubmitButton variant={selected.button} className="w-full" pendingLabel="Recording…">
          <selected.icon aria-hidden="true" />
          {decision === "approve" ? `Approve version ${version}` : decision === "request_changes" ? "Send back for changes" : "Reject submission"}
        </SubmitButton>
      ) : (
        <SubmitButton variant="secondary" className="w-full" disabled>
          Choose a decision
        </SubmitButton>
      )}
    </form>
  );
}

function RationaleField({
  decision,
  openHighFindings,
  defaultValue,
  error,
}: {
  decision: Decision;
  openHighFindings: number;
  defaultValue?: string;
  error?: string;
}) {
  const needsRationale = approvalNeedsRationale(decision, openHighFindings);
  const required = decision !== "approve" || needsRationale;
  const label =
    decision === "approve"
      ? needsRationale
        ? "Why it's safe to approve"
        : "Note for the record (optional)"
      : decision === "request_changes"
        ? "What needs to change"
        : "Why it's rejected";

  return (
    <div className="space-y-1.5">
      <Label htmlFor="decision-comment">
        {label}
        {required ? <span className="text-high-600"> *</span> : null}
      </Label>
      <Textarea
        id="decision-comment"
        name="comment"
        rows={4}
        maxLength={LIMITS.commentMax}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={Boolean(error)}
        aria-describedby={["decision-hint", error ? "decision-comment-error" : null].filter(Boolean).join(" ")}
        placeholder={
          decision === "approve"
            ? "e.g. APR disclosure runs in the end frame, confirmed with the creative team."
            : "Be specific: quote the line and say what would fix it."
        }
        className="text-sm"
      />
      <FieldHint id="decision-hint">
        {needsRationale
          ? `This version still has ${pluralize(openHighFindings, "high-severity finding")}. Approving is allowed, but the reason goes on the audit trail.`
          : decision === "approve"
            ? "Recorded on the audit trail with your name and the time."
            : `At least ${LIMITS.rationaleMin} characters, so the submitter knows what to do next.`}
      </FieldHint>
      <FieldError id="decision-comment-error" message={error} />
    </div>
  );
}
