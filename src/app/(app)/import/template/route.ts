import { buildTrackerTemplate } from "@/domain/import/tracker-template";
import { workbookResponse } from "../download";

export function GET(request: Request) {
  return workbookResponse(request, "ClearPath review tracker template.xlsx", buildTrackerTemplate);
}
