import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/format";
import { referenceSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth";
import { getSubmissionDetail } from "@/server/queries/submission";
import { ResubmitForm } from "./resubmit-form";

export const metadata: Metadata = { title: "Revise submission" };

export default async function RevisePage({ params }: PageProps<"/submissions/[reference]/revise">) {
  const user = await requireUser();
  const reference = referenceSchema.safeParse((await params).reference);
  if (!reference.success) notFound();
  const detail = await getSubmissionDetail(user, reference.data);
  if (!detail) notFound();

  const current = detail.versions[detail.versions.length - 1];
  const back = `/submissions/${detail.reference}`;

  if (!detail.permissions.resubmit.allowed) {
    return (
      <div className="mx-auto max-w-xl space-y-5 py-10">
        <Notice tone="guard" title="This submission can't be revised right now">
          {detail.permissions.resubmit.reason}
        </Notice>
        <Link href={back} className={buttonClasses({ variant: "secondary" })}>
          <ArrowLeft aria-hidden="true" />
          Back to {detail.reference}
        </Link>
      </div>
    );
  }

  const request = [...detail.timeline].reverse().find((t) => t.kind === "event" && t.action === "decision.changes_requested");

  return (
    <div className="space-y-6">
      <Link href={back} className="inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-500 hover:text-ink-900">
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {detail.reference}
      </Link>
      <PageHeader
        context={`Revising ${detail.reference}`}
        title={detail.title}
        description="Edit the copy below. The pre-check updates as you type and shows what you've fixed since the version that was sent back."
      />

      {request?.kind === "event" && request.attachment ? (
        <figure className="rounded-xl border border-medium-200 bg-medium-50/70 px-5 py-4">
          <figcaption className="text-[0.8125rem] font-medium text-medium-800">
            {request.actor?.name} requested changes on version {current.version} · {formatDateTime(request.at)}
          </figcaption>
          <blockquote className="mt-2 text-[0.9375rem] leading-relaxed text-ink-800">{request.attachment}</blockquote>
        </figure>
      ) : null}

      <ResubmitForm
        reference={detail.reference}
        currentBody={current.body}
        currentVersion={current.version}
        currentFindings={current.findings}
        productLine={detail.productLine}
        channel={detail.channel}
      />
    </div>
  );
}
