"use client";

import { Eye } from "lucide-react";
import { useActionState } from "react";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { IDLE } from "@/lib/form-state";
import { startReviewAction } from "@/server/actions/submissions";

export function ClaimForm({ reference, label }: { reference: string; label: string }) {
  const [state, formAction] = useActionState(startReviewAction, IDLE);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="reference" value={reference} />
      <SubmitButton variant="primary" className="w-full" pendingLabel="Starting…">
        <Eye aria-hidden="true" />
        {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
