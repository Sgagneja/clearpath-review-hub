import { ForbiddenError } from "@/domain/permissions";
import { referenceSchema } from "@/lib/validation";
import { UserFacingError } from "@/server/errors";
import { guardMutation } from "@/server/guard";
import { exportAuditCsv } from "@/server/queries/audit";
import type { ExportProblem } from "../export-problem";

/**
 * CSV export of the audit trail: everything, or one queue item's trail when
 * the form sends its reference. POST, not GET: exporting is itself recorded
 * as an audit event, and a side effect behind a GET could be fired by any
 * cross-site link. Route handlers get no built-in CSRF check, so
 * `guardMutation()` supplies the origin check, session and rate limit.
 *
 * The form posts natively, so a failure would otherwise leave the browser on
 * a bare error response. Instead it goes back to the page it came from with a
 * code the page turns into a plain sentence.
 */
export async function POST(request: Request) {
  const sent = (await request.formData().catch(() => null))?.get("reference");
  const reference = typeof sent === "string" && sent ? referenceSchema.safeParse(sent) : null;
  const back = reference?.success ? `/audit/${reference.data}` : "/audit";
  try {
    const user = await guardMutation();
    if (reference && !reference.success) throw new UserFacingError("Unknown submission reference.");
    const { csv, filename } = await exportAuditCsv(user, { reference: reference?.data });
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    let problem: ExportProblem = "failed";
    if (error instanceof ForbiddenError) problem = "denied";
    else if (error instanceof UserFacingError) problem = "retry";
    else console.error("[audit export] unexpected failure", error);
    return Response.redirect(new URL(`${back}?export=${problem}`, request.url), 303);
  }
}
