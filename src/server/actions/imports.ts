"use server";

import { redirect } from "next/navigation";
import { fromCompanyWallTime, parseDateText } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { checkSpreadsheetFile } from "@/lib/spreadsheet";
import { importEmailSchema } from "@/lib/validation";
import { UserFacingError } from "../errors";
import { formValues, guardMutation, parse, runAction } from "../guard";
import { checkTrackerFile, importEmail, importTrackerFile, type TrackerPreview } from "../services/imports";

/** The spreadsheet form shows a preview between "check" and "import". */
export type TrackerFormState = FormState | { status: "checked"; preview: TrackerPreview };

async function uploadedSpreadsheet(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name) throw new UserFacingError("Choose a spreadsheet to import.", "file");
  const problem = checkSpreadsheetFile(file.name, file.size);
  if (problem) throw new UserFacingError(problem, "file");
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}

/**
 * One action, two steps, so the page has a single state to render:
 *   intent=check   read and check the file, save nothing, return a preview
 *   intent=import  check the same file again and import every row, or none
 */
export async function trackerAction(_prev: TrackerFormState, formData: FormData): Promise<TrackerFormState> {
  return runAction<TrackerFormState>(async () => {
    const actor = await guardMutation();
    const file = await uploadedSpreadsheet(formData);
    if (formData.get("intent") !== "import") {
      return { status: "checked", preview: await checkTrackerFile(actor, file) };
    }
    const result = await importTrackerFile(actor, file);
    if (!result.ok) return { status: "checked", preview: result.preview };
    redirect(`/import/${result.importId}?done=1`);
  });
}

const DAY_MS = 86_400_000;

export async function importEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  return runAction(async () => {
    const actor = await guardMutation();
    const now = new Date();
    const input = parse(importEmailSchema(now), values);

    const parts = parseDateText(input.receivedAt);
    if (!parts) throw new UserFacingError("Add when the email arrived.", "receivedAt");
    const receivedAt = fromCompanyWallTime(parts);
    if (receivedAt.getTime() > now.getTime() + 5 * 60_000) {
      throw new UserFacingError("That time is in the future. Use when the email arrived in the inbox.", "receivedAt");
    }
    if (receivedAt.getTime() < now.getTime() - 365 * DAY_MS) {
      throw new UserFacingError("This email is more than a year old. Send the copy as a new submission instead.", "receivedAt");
    }

    const { reference } = await importEmail(actor, { ...input, receivedAt });
    redirect(`/submissions/${reference}?imported=1`);
  }, values);
}
