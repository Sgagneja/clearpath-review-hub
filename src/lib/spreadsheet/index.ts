import { checkSpreadsheetFile, extensionOf } from "./file-rules";
import { readCsv } from "./read-csv";
import { readXlsx } from "./read-xlsx";
import { SpreadsheetFileError, type ReadOptions, type Sheet } from "./types";

export { ACCEPTED_EXTENSIONS, checkSpreadsheetFile, extensionOf, formatFileSize, MAX_FILE_BYTES } from "./file-rules";
export { SpreadsheetFileError } from "./types";
export type { CellValue, Sheet, SheetRow } from "./types";

/** Reads a tracker upload, refusing anything that isn't an .xlsx or .csv we can trust. */
export function readSpreadsheet(
  fileName: string,
  bytes: Uint8Array,
  options: ReadOptions & { preferredTab: string },
): Sheet {
  const problem = checkSpreadsheetFile(fileName, bytes.byteLength);
  if (problem) throw new SpreadsheetFileError(problem);
  return extensionOf(fileName) === "csv"
    ? readCsv(bytes, fileName, options)
    : readXlsx(bytes, options.preferredTab, options);
}
