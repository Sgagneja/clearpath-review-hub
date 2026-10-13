import { Check, ChevronRight, Download, FileSpreadsheet, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TRACKER_COLUMNS, TRACKER_MAX_ROWS, TRACKER_TAB } from "@/domain/import/tracker";
import { authorize } from "@/domain/permissions";
import { ROLE_LABELS } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatFileSize, MAX_FILE_BYTES } from "@/lib/spreadsheet";
import { homePathFor, requireUser } from "@/server/auth";
import { getDirectory } from "@/server/queries/directory";
import { TrackerUploader } from "./tracker-uploader";

export const metadata: Metadata = { title: "Import a spreadsheet" };

const ACCEPTED = [
  "Excel workbooks (.xlsx) and CSV files",
  `The tab named “${TRACKER_TAB}”, or the first tab if there isn't one`,
  "Column names on row 1, spelled as in the template",
  `One review per row, up to ${TRACKER_MAX_ROWS} per file`,
  `Files up to ${formatFileSize(MAX_FILE_BYTES)}`,
];

/** Column guide rows stack on phones and line up as three columns from tablets up. */
const GUIDE_GRID = "px-5 md:grid-cols-[11rem_minmax(0,1fr)_12rem] md:gap-x-6";

const REFUSED = [
  "Older Excel files (.xls) and workbooks with macros (.xlsm)",
  "Password-protected workbooks",
  "Google Sheets or Numbers files, until they're downloaded as .xlsx",
  "Copy that only exists in a screenshot or an attachment",
];

export default async function SpreadsheetImportPage() {
  const user = await requireUser();
  const access = authorize(user, "import.run");
  if (!access.allowed) return <AccessDenied reason={access.reason} home={homePathFor(user.role)} />;
  const { people } = await getDirectory();

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
            Excel tracker
          </li>
        </ol>
      </nav>

      <PageHeader
        title="Import your Excel tracker"
        description="Open reviews join the queue with their real deadlines, already pre-checked, so reviewers can pick them up straight away. Closed reviews become history on the dashboard and in the audit trail."
      />

      <Card aria-labelledby="step-template">
        <CardHeader
          titleId="step-template"
          title={<StepTitle n={1}>Put your reviews in our template</StepTitle>}
          description="One row per review. Dropdowns only offer values we accept, so most mistakes can't happen."
        />
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <a href="/import/template" className={buttonClasses({ variant: "primary" })} download>
            <Download aria-hidden="true" />
            Download the template
          </a>
          <a href="/import/example" className={buttonClasses({ variant: "secondary" })} download>
            <FileSpreadsheet aria-hidden="true" />
            See a filled-in example
          </a>
          <p className="text-xs text-ink-500 sm:ml-2 sm:max-w-64">The example has eight reviews and imports cleanly, if you&apos;d like to try it first.</p>
        </CardBody>
        <div className="grid gap-x-8 gap-y-5 border-t border-line bg-paper/40 px-5 py-4 md:grid-cols-2">
          <div>
            <p className="eyebrow mb-2.5 text-ink-500">What we can read</p>
            <List items={ACCEPTED} tone="yes" />
          </div>
          <div>
            <p className="eyebrow mb-2.5 text-ink-500">What we can&apos;t</p>
            <List items={REFUSED} tone="no" />
          </div>
        </div>
      </Card>

      <section aria-labelledby="step-upload" className="space-y-3">
        <h2 id="step-upload" className="text-[0.9375rem] font-semibold text-ink-950">
          <StepTitle n={2}>Upload it and check the results</StepTitle>
        </h2>
        <TrackerUploader />
      </section>

      <Card aria-labelledby="columns-title">
        <CardHeader
          titleId="columns-title"
          title="Column guide"
          description="What each column in the template means. Keep the names on row 1 as they are; the order doesn't matter."
        />
        <div aria-hidden="true" className={cn(GUIDE_GRID, "eyebrow hidden border-b border-line bg-paper/60 py-2.5 font-medium text-ink-500 md:grid")}>
          <span>Column</span>
          <span>What to enter</span>
          <span>Example</span>
        </div>
        <ul className="divide-y divide-line text-[0.8125rem]">
          {TRACKER_COLUMNS.map((c) => (
            <li key={c.field} className={cn(GUIDE_GRID, "grid gap-y-2 py-3.5")}>
              <div>
                <p className="font-semibold text-ink-900">{c.header}</p>
                <p className="mt-0.5 text-xs text-ink-500">{c.requirement}</p>
              </div>
              <div className="text-ink-700">
                {c.description}
                {c.allowed ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Allowed values">
                    {c.allowed.map((v) => (
                      <li key={v} className="rounded-sm bg-ink-50 px-1.5 py-0.5 text-[0.6875rem] font-medium text-ink-700 ring-1 ring-inset ring-ink-200">
                        {v}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <p className="text-ink-500">
                <span className="eyebrow mr-2 text-ink-400 md:sr-only">Example</span>
                {c.example}
              </p>
            </li>
          ))}
        </ul>
        <CardBody className="space-y-3 border-t border-line">
          <div>
            <h3 className="text-[0.8125rem] font-semibold text-ink-900">Names we recognise</h3>
            <p className="mt-0.5 text-xs text-ink-500">For “Submitted by” and “Reviewer”, use one of these names or the person&apos;s work email.</p>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {people.map((p) => (
                <li key={p.id} className="rounded-md bg-white px-2 py-1 text-xs ring-1 ring-inset ring-line">
                  <span className="font-medium text-ink-900">{p.name}</span>
                  <span className="text-ink-500"> · {p.role === "submitter" ? p.team : ROLE_LABELS[p.role]}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-ink-500">Dates are month/day/year in Eastern time, typed or picked in Excel. When there&apos;s no time, we use midday.</p>
        </CardBody>
      </Card>
    </div>
  );
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="tabular-nums text-ink-400">{n}.</span>
      {children}
    </span>
  );
}

function List({ items, tone }: { items: string[]; tone: "yes" | "no" }) {
  const Icon = tone === "yes" ? Check : X;
  return (
    <ul className="space-y-2 text-[0.8125rem] text-ink-700">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <Icon className={tone === "yes" ? "mt-0.5 size-3.5 shrink-0 text-approve-600" : "mt-0.5 size-3.5 shrink-0 text-ink-400"} aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}
