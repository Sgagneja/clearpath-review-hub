import { ArrowRight, ChevronRight, FileSpreadsheet, MailPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AccessDenied } from "@/components/access-denied";
import { SeverityGlyph } from "@/components/severity";
import { StatusBadge } from "@/components/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { authorize } from "@/domain/permissions";
import type { SlaState } from "@/domain/sla";
import { SEVERITY_LABELS } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDuration, pluralize } from "@/lib/format";
import { firstValues } from "@/lib/validation";
import { homePathFor, requireUser } from "@/server/auth";
import { getImport, type ImportedItem } from "@/server/queries/imports";

export const metadata: Metadata = { title: "Import" };

const DEADLINE_TONE: Partial<Record<SlaState, string>> = {
  overdue: "text-high-700 font-semibold",
  due_soon: "text-medium-700 font-medium",
};

export default async function ImportDetailPage({ params, searchParams }: PageProps<"/import/[id]">) {
  const user = await requireUser();
  const access = authorize(user, "import.run");
  if (!access.allowed) return <AccessDenied reason={access.reason} home={homePathFor(user.role)} />;

  const [{ id }, query] = await Promise.all([params, searchParams.then(firstValues)]);
  if (!z.uuid().safeParse(id).success) notFound();
  const now = new Date();
  const batch = await getImport(user, id, now);
  if (!batch) notFound();

  const name = batch.kind === "spreadsheet" ? (batch.fileName ?? "Spreadsheet") : "Email request";
  const overdue = batch.open.filter((i) => i.sla === "overdue").length;

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
          <li aria-current="page" className="max-w-64 truncate text-ink-700">
            {name}
          </li>
        </ol>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
            {batch.kind === "spreadsheet" ? <FileSpreadsheet className="size-5" aria-hidden="true" /> : <MailPlus className="size-5" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <h1 className="font-serif text-[2rem] font-medium leading-tight tracking-[-0.015em] text-ink-950 wrap-anywhere md:truncate">{name}</h1>
            <p className="mt-1 text-ink-600">
              {pluralize(batch.count, "review")} imported by {batch.importedBy} · {formatDateTime(batch.importedAt)}
            </p>
          </div>
        </div>
        {batch.open.length > 0 ? (
          <Link href="/queue" className={buttonClasses({ variant: "brand" })}>
            Open the review queue
            <ArrowRight aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      {query.done ? (
        <Notice tone="success" role="status" title={`Imported ${pluralize(batch.count, "review")}`}>
          {batch.open.length > 0
            ? `${pluralize(batch.open.length, "open review")} joined the queue${overdue ? `, ${overdue} of them already past ${overdue === 1 ? "its" : "their"} deadline` : ""}. `
            : "Everything was closed, so it's all in the history. "}
          The import is recorded in the audit trail.
        </Notice>
      ) : null}

      {batch.open.length > 0 ? (
        <Card aria-labelledby="open-title">
          <CardHeader titleId="open-title" title="Now in the queue" description="Most urgent first. These need a reviewer." />
          <ItemList items={batch.open} now={now} fileName={batch.fileName} showDeadline />
        </Card>
      ) : null}

      {batch.closed.length > 0 ? (
        <Card aria-labelledby="closed-title">
          <CardHeader
            titleId="closed-title"
            title="Already decided"
            description="Decided in the old process and kept with their notes. Anything sent back for changes is waiting on its submitter to revise it. Find them all in the queue under All."
          />
          <ItemList items={batch.closed} now={now} fileName={batch.fileName} />
        </Card>
      ) : null}
    </div>
  );
}

/** The page header already names the file, so each row only needs its row number and tracker ID. */
function rowLabel(sourceLabel: string | null, fileName: string | null) {
  if (!sourceLabel) return null;
  const prefix = fileName ? `“${fileName}” · ` : "";
  if (!prefix || !sourceLabel.startsWith(prefix)) return sourceLabel;
  const rest = sourceLabel.slice(prefix.length);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

function ItemList({
  items,
  now,
  fileName,
  showDeadline = false,
}: {
  items: ImportedItem[];
  now: Date;
  fileName: string | null;
  showDeadline?: boolean;
}) {
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.reference}>
          <Link
            href={`/submissions/${item.reference}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-paper/60 md:grid-cols-[6.5rem_minmax(0,1fr)_9.5rem_9rem_8rem]"
          >
            <span className="font-mono text-xs text-brand-700 max-md:hidden">{item.reference}</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink-900 md:truncate">{item.title}</span>
              {item.sourceLabel ? <span className="block text-xs text-ink-500 md:truncate">{rowLabel(item.sourceLabel, fileName)}</span> : null}
            </span>
            <span className="md:justify-self-start">
              <StatusBadge status={item.status} />
            </span>
            <span className="flex items-center gap-1.5 text-[0.8125rem] text-ink-700 max-md:hidden">
              {item.assignee ? (
                <>
                  <Avatar person={item.assignee} size="xs" />
                  <span className="truncate">{item.assignee.name}</span>
                </>
              ) : (
                <span className="text-ink-400">Not assigned</span>
              )}
            </span>
            <span className="text-[0.8125rem] max-md:col-span-2 md:text-right">
              {showDeadline ? (
                <span className={cn("text-ink-600", item.sla && DEADLINE_TONE[item.sla])}>
                  {item.sla === "overdue"
                    ? `Overdue by ${formatDuration(now.getTime() - item.dueAt.getTime())}`
                    : `Due in ${formatDuration(item.dueAt.getTime() - now.getTime())}`}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-ink-600">
                  <SeverityGlyph severity={item.riskLevel} />
                  {SEVERITY_LABELS[item.riskLevel]} risk
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
