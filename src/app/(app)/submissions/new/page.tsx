import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { can, type Actor } from "@/domain/permissions";
import { findScenario } from "@/domain/precheck/scenarios";
import { PRODUCT_LINE_LABELS } from "@/domain/types";
import { requireUser } from "@/server/auth";
import { SAMPLES, type SampleCopy } from "./samples";
import { SubmissionForm } from "./submission-form";

export const metadata: Metadata = { title: "New submission" };

/**
 * `?example=` opens the form already filled in: a sample for anyone, or one
 * of the Rule library's test cases for compliance. Unknown ids are ignored.
 */
function exampleFor(user: Actor, id: string | undefined): { copy: SampleCopy; testCase: boolean } | null {
  if (!id) return null;
  const sample = SAMPLES.find((s) => s.id === id);
  if (sample) return { copy: sample, testCase: false };
  const scenario = can(user, "rules.test") ? findScenario(id) : undefined;
  if (!scenario) return null;
  const { label, productLine, channel, body } = scenario;
  return { copy: { id, label, title: label, productLine, channel, body }, testCase: true };
}

export default async function NewSubmissionPage({ searchParams }: PageProps<"/submissions/new">) {
  // Every role may submit (compliance drafts disclosure snippets too), so
  // signing in is the only requirement. The action checks again.
  const user = await requireUser();
  const { example: requested } = await searchParams;
  const example = exampleFor(user, typeof requested === "string" ? requested : undefined);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Send copy to compliance"
        description="The pre-check reads your copy as you type, so you can fix the obvious issues before a reviewer ever sees them."
      />
      {example?.testCase ? (
        <Notice title={`Test case: ${example.copy.label}`}>
          A {PRODUCT_LINE_LABELS[example.copy.productLine].toLowerCase()} case from the{" "}
          <Link href={`/rules?product=${example.copy.productLine}`} className="font-medium underline underline-offset-2">
            Rule library
          </Link>
          . Change the copy and watch the pre-check respond. Nothing is saved or sent to the queue unless you press Submit for review.
        </Notice>
      ) : null}
      <SubmissionForm key={example?.copy.id ?? "blank"} today={today} samples={SAMPLES} initial={example?.copy} />
    </div>
  );
}
