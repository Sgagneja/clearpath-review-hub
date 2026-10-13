/** Why an audit download didn't happen. Only these codes are read back from the URL. */
export const EXPORT_PROBLEMS = {
  denied: "Only the Compliance Lead can download the audit trail.",
  retry: "The download didn't start. Wait a few seconds and try again.",
  failed: "The download didn't work on our side. Nothing was changed. Try again in a minute.",
} as const;

export type ExportProblem = keyof typeof EXPORT_PROBLEMS;

export function exportProblemMessage(code: unknown): string | null {
  return typeof code === "string" && Object.hasOwn(EXPORT_PROBLEMS, code) ? EXPORT_PROBLEMS[code as ExportProblem] : null;
}
