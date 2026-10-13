import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/server/auth";
import { SAMPLES } from "./samples";
import { SubmissionForm } from "./submission-form";

export const metadata: Metadata = { title: "New submission" };

export default async function NewSubmissionPage() {
  // Every role may submit (compliance drafts disclosure snippets too), so
  // signing in is the only requirement. The action checks again.
  await requireUser();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Send copy to compliance"
        description="The pre-check reads your copy as you type, so you can fix the obvious issues before a reviewer ever sees them."
      />
      <SubmissionForm today={today} samples={SAMPLES} />
    </div>
  );
}
