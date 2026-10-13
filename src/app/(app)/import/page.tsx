import { ArrowRight, FileSpreadsheet, MailPlus, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { authorize } from "@/domain/permissions";
import { formatDateTime, pluralize } from "@/lib/format";
import { homePathFor, requireUser } from "@/server/auth";
import { listImports } from "@/server/queries/imports";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage() {
  const user = await requireUser();
  const access = authorize(user, "import.run");
  if (!access.allowed) return <AccessDenied reason={access.reason} home={homePathFor(user.role)} />;

  const history = await listImports(user);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Import"
        title="Bring your reviews into one place"
        description="Move the work still sitting in Excel and the compliance inbox into Review Hub. Open requests join the queue with their real deadlines, and past decisions become history you can search and report on."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Choice
          href="/import/spreadsheet"
          icon={FileSpreadsheet}
          title="From your Excel tracker"
          body="Past and in-progress reviews, up to 500 at a time. Copy them into our template so every column lines up, and we check each row before anything is saved."
          meta="Excel (.xlsx) or CSV"
          cta="Import a spreadsheet"
        />
        <Choice
          href="/import/email"
          icon={MailPlus}
          title="From a review request email"
          body="Paste an email, or upload one you've saved. We pull out the copy, who sent it and when it arrived, then you confirm the details."
          meta="Pasted text or a saved email (.eml)"
          cta="Bring in an email"
        />
      </div>

      <Card aria-labelledby="history-title">
        <CardHeader titleId="history-title" title="Recent imports" description="Every import is also recorded in the audit trail." />
        {history.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-500">Nothing has been imported yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {history.map((item) => (
              <li key={item.id}>
                <Link href={`/import/${item.id}`} className="group flex items-center gap-4 px-5 py-3 hover:bg-paper/60">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-paper text-ink-500 ring-1 ring-line">
                    {item.kind === "spreadsheet" ? <FileSpreadsheet className="size-4" aria-hidden="true" /> : <MailPlus className="size-4" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">
                      {item.kind === "spreadsheet" ? item.fileName : item.fileName ? `Email · ${item.fileName}` : "Pasted email"}
                    </span>
                    <span className="block text-xs text-ink-500">
                      {item.importedBy} · {formatDateTime(item.importedAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.8125rem] tabular-nums text-ink-600">{pluralize(item.count, "review")}</span>
                  <ArrowRight className="size-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-500" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Choice({ href, icon: Icon, title, body, meta, cta }: { href: string; icon: LucideIcon; title: string; body: string; meta: string; cta: string }) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-xl border border-line bg-white p-6 shadow-[var(--shadow-card)] transition-colors hover:border-brand-300"
    >
      <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-serif text-[1.375rem] font-medium leading-snug text-ink-950">{title}</h2>
      <p className="mt-2 flex-1 text-[0.875rem] leading-relaxed text-ink-600">{body}</p>
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
        <span className="text-xs text-ink-500">{meta}</span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
          {cta}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
