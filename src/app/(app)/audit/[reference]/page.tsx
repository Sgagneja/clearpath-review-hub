import { ArrowRight, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { StatusBadge } from "@/components/status-badge";
import { buttonClasses } from "@/components/ui/button";
import { authorize, can } from "@/domain/permissions";
import { CHANNEL_LABELS, PRODUCT_LINE_LABELS } from "@/domain/types";
import { pluralize } from "@/lib/format";
import { firstValues, referenceSchema } from "@/lib/validation";
import { homePathFor, requireUser } from "@/server/auth";
import { getAuditTrail } from "@/server/queries/audit";
import { EventList, ExportButton, ExportProblem, PermanentNote } from "../parts";

export async function generateMetadata({ params }: PageProps<"/audit/[reference]">): Promise<Metadata> {
  const { reference } = await params;
  return { title: `${reference} · Audit trail` };
}

/** One queue item's complete trail, oldest first: the page to hand an examiner who asks about one ad. */
export default async function AuditTrailPage({ params, searchParams }: PageProps<"/audit/[reference]">) {
  const user = await requireUser();
  const access = authorize(user, "audit.view");
  if (!access.allowed) return <AccessDenied reason={access.reason} home={homePathFor(user.role)} />;

  const [{ reference: raw }, query] = await Promise.all([params, searchParams.then(firstValues)]);
  const reference = referenceSchema.safeParse(raw);
  if (!reference.success) notFound();
  const trail = await getAuditTrail(user, reference.data);
  if (!trail) notFound();
  const { item, events } = trail;

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-[0.8125rem] text-ink-500">
          <li>
            <Link href="/audit" className="hover:text-ink-900 hover:underline">
              Audit trail
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page" className="font-mono text-xs text-ink-700">
            {item.reference}
          </li>
        </ol>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">{item.title}</h1>
          <p className="mt-1.5 max-w-[75ch] text-ink-600">Every recorded step for this queue item, oldest first.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link href={`/submissions/${item.reference}`} className={buttonClasses({ variant: "secondary" })}>
            Open the submission
            <ArrowRight aria-hidden="true" />
          </Link>
          <ExportButton canExport={can(user, "audit.export")} reference={item.reference} />
        </div>
      </header>

      <ExportProblem code={query.export} />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-line py-3 sm:grid-cols-3 lg:grid-cols-5">
        <Fact label="Status">
          <StatusBadge status={item.status} />
        </Fact>
        <Fact label="Product">{PRODUCT_LINE_LABELS[item.productLine]}</Fact>
        <Fact label="Channel">{CHANNEL_LABELS[item.channel]}</Fact>
        <Fact label="Submitted by">{item.submitter?.name ?? "Unknown"}</Fact>
        <Fact label="Reviewer">{item.assignee?.name ?? "Not assigned"}</Fact>
      </dl>

      <PermanentNote />

      <section aria-labelledby="trail-title" className="rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
        <h2 id="trail-title" className="border-b border-line px-4 py-3 text-[0.9375rem] font-semibold text-ink-950 sm:px-5">
          {pluralize(events.length, "event")}
        </h2>
        <EventList rows={events} caption={`Every event for ${item.reference}, oldest first`} />
      </section>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow text-ink-500">{label}</dt>
      <dd className="mt-1 truncate text-[0.8125rem] text-ink-900">{children}</dd>
    </div>
  );
}
