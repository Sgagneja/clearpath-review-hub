import type { Metadata } from "next";
import { AccessDenied } from "@/components/access-denied";
import { ACTIVITY_ACTIONS, AUDIT_ACTIONS } from "@/domain/audit";
import { authorize, can } from "@/domain/permissions";
import { auditFiltersSchema, firstValues } from "@/lib/validation";
import { homePathFor, requireUser } from "@/server/auth";
import { AUDIT_PAGE_SIZE, getAuditActivity, getAuditCounts } from "@/server/queries/audit";
import { AuditFilters } from "../audit-filters";
import { AuditHeader, EventList, ExportProblem, listHref, Pagination, PermanentNote } from "../parts";

export const metadata: Metadata = { title: "Sign-ins, imports and downloads · Audit trail" };

const EVENT_OPTIONS = [{ value: "all", label: "All of these" }, ...ACTIVITY_ACTIONS.map((a) => ({ value: a, label: AUDIT_ACTIONS[a] }))];

export default async function AuditActivityPage({ searchParams }: PageProps<"/audit/activity">) {
  const user = await requireUser();
  const access = authorize(user, "audit.view");
  if (!access.allowed) return <AccessDenied reason={access.reason} home={homePathFor(user.role)} />;

  const params = firstValues(await searchParams);
  const filters = auditFiltersSchema.parse(params);
  const [log, counts] = await Promise.all([getAuditActivity(user, filters), getAuditCounts(user)]);
  const first = log.total === 0 ? 0 : (log.page - 1) * AUDIT_PAGE_SIZE + 1;
  const last = Math.min(log.total, log.page * AUDIT_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <AuditHeader active="activity" counts={counts} canExport={can(user, "audit.export")} />
      <ExportProblem code={params.export} />
      <PermanentNote />

      <div className="rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <AuditFilters
            path="/audit/activity"
            label="Filter sign-ins, imports and downloads"
            q={filters.q}
            searchLabel="Search by name or file"
            placeholder="Name or file"
            select={{ name: "action", label: "Event type", value: filters.action, options: EVENT_OPTIONS }}
          />
          <p className="text-xs tabular-nums text-ink-500">
            {first}–{last} of {log.total}
          </p>
        </div>

        {log.rows.length === 0 ? (
          <p className="px-5 py-14 text-center text-sm text-ink-500">No events match these filters.</p>
        ) : (
          <EventList rows={log.rows} caption="Sign-ins, imports and downloads, newest first" />
        )}

        <Pagination
          page={log.page}
          pageCount={log.pageCount}
          href={(page) => listHref("/audit/activity", { q: filters.q, action: filters.action, page })}
        />
      </div>
    </div>
  );
}
