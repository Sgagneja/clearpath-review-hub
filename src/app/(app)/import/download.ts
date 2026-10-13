import "server-only";
import { can } from "@/domain/permissions";
import { getCurrentUser } from "@/server/auth";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Serves one of the generated workbooks to compliance staff. These are plain
 * GETs with no side effects, so a link is enough; anyone else is sent to a
 * page that explains why rather than receiving a bare error.
 */
export async function workbookResponse(request: Request, fileName: string, build: () => Uint8Array): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(new URL("/login?next=/import/spreadsheet", request.url), 303);
  if (!can(user, "import.run")) return Response.redirect(new URL("/import", request.url), 303);

  return new Response(build() as Uint8Array<ArrayBuffer>, {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
