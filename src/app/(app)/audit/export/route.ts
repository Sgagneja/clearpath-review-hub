import { ForbiddenError } from "@/domain/permissions";
import { UserFacingError } from "@/server/errors";
import { guardMutation } from "@/server/guard";
import { exportAuditCsv } from "@/server/queries/audit";

/**
 * CSV export of the full audit trail. POST, not GET: exporting is itself
 * recorded as an audit event, and a side effect behind a GET could be fired
 * by any cross-site link. Route handlers get no built-in CSRF check, so
 * `guardMutation()` supplies the origin check, session and rate limit.
 */
export async function POST() {
  try {
    const user = await guardMutation();
    const { csv, filename } = await exportAuditCsv(user);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return new Response(error.message, { status: 403 });
    if (error instanceof UserFacingError) return new Response(error.message, { status: 400 });
    throw error;
  }
}
