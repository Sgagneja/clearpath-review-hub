/**
 * The checks that need only a file's name and size. Kept apart from the
 * readers so the browser can run them instantly, before uploading anything,
 * without pulling the unzip code into the page. The server runs them again.
 */

export const ACCEPTED_EXTENSIONS = [".xlsx", ".csv"] as const;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Formats people commonly try, with what to do instead. */
const REFUSED: Record<string, string> = {
  xls: "This is the older Excel format (.xls). In Excel choose File › Save As › “Excel Workbook (.xlsx)” and upload that.",
  xlsm: "Workbooks with macros (.xlsm) aren't accepted. In Excel choose File › Save As › “Excel Workbook (.xlsx)”, which leaves the macros out.",
  xlsb: "Binary workbooks (.xlsb) aren't accepted. In Excel choose File › Save As › “Excel Workbook (.xlsx)”.",
  numbers: "This is an Apple Numbers file. In Numbers choose File › Export To › Excel, then upload the .xlsx.",
  ods: "This is an OpenDocument spreadsheet. Save it as “Excel Workbook (.xlsx)” and upload that.",
  gsheet: "This is a shortcut to a Google Sheet, not the sheet itself. In Google Sheets choose File › Download › Microsoft Excel (.xlsx).",
};

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function checkSpreadsheetFile(fileName: string, size: number): string | null {
  const ext = extensionOf(fileName);
  if (REFUSED[ext]) return REFUSED[ext];
  if (ext !== "xlsx" && ext !== "csv") {
    return ext
      ? `We can read Excel workbooks (.xlsx) and CSV files (.csv). This file is a .${ext}.`
      : "We can read Excel workbooks (.xlsx) and CSV files (.csv). This file has no extension, so we can't tell what it is.";
  }
  if (size === 0) return "This file is empty.";
  if (size > MAX_FILE_BYTES) {
    return `This file is ${formatFileSize(size)}, over the ${formatFileSize(MAX_FILE_BYTES)} limit. Split the tracker into smaller files and import them one at a time.`;
  }
  return null;
}
