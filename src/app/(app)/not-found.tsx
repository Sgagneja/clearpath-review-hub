import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

/** In-app 404: keeps the sidebar, and doesn't reveal whether the record exists. */
export default function SubmissionNotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-white text-ink-500 ring-1 ring-line">
        <FileQuestion className="size-5" aria-hidden="true" />
      </span>
      <p className="eyebrow mt-5 text-brand-700">404</p>
      <h1 className="mt-1 font-serif text-[1.75rem] font-medium text-ink-950">Nothing filed under that reference</h1>
      <p className="mt-2 text-ink-600">
        It may not exist, or your role can&apos;t see it. Submitters only see their own work.
      </p>
      <Link href="/queue" className={buttonClasses({ variant: "secondary", className: "mt-6" })}>
        Back to the queue
      </Link>
    </div>
  );
}
