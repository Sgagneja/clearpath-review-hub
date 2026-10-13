import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { PageHeader } from "@/components/ui/page-header";
import { authorize } from "@/domain/permissions";
import { companyToday } from "@/lib/dates";
import { homePathFor, requireUser } from "@/server/auth";
import { getDirectory } from "@/server/queries/directory";
import { EmailImporter } from "./email-importer";
import { sampleEmail } from "./sample";

export const metadata: Metadata = { title: "Import an email" };

export default async function EmailImportPage() {
  const user = await requireUser();
  const access = authorize(user, "import.run");
  if (!access.allowed) return <AccessDenied reason={access.reason} home={homePathFor(user.role)} />;

  const { people } = await getDirectory();
  const today = companyToday();

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-[0.8125rem] text-ink-500">
          <li>
            <Link href="/import" className="hover:text-ink-900 hover:underline">
              Import
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page" className="text-ink-700">
            Email
          </li>
        </ol>
      </nav>

      <PageHeader
        title="Bring in a review request from email"
        description="Paste the email or upload the saved file. We pull out the copy, who sent it and when it arrived, and you check everything before it joins the queue. Its review deadline counts from when the email arrived, not from today."
      />

      <EmailImporter
        people={people.map(({ id, name, role, team }) => ({ id, name, role, team }))}
        today={today}
        sample={sampleEmail(today)}
      />
    </div>
  );
}
