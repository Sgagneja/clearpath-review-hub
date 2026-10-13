import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

/** In-app 404: keeps the sidebar, and doesn't reveal whether the record exists. */
export default function SubmissionNotFound() {
  return (
    <div className="max-w-xl py-6">
      <h1 className="page-title">Nothing filed under that reference</h1>
      <p className="mt-2 text-ink-600">It may not exist, or your role can&apos;t see it. Submitters only see their own work.</p>
      <Link href="/queue" className={buttonClasses({ variant: "secondary", className: "mt-6" })}>
        Back to the queue
      </Link>
    </div>
  );
}
