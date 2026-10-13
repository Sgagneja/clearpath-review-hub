/** A cell as the spreadsheet stored it, before any business meaning is applied. */
export type CellValue = string | number | boolean | null;

export interface SheetRow {
  /** The row number the user sees in Excel (1-based), so messages can point at it. */
  number: number;
  cells: CellValue[];
}

export interface Sheet {
  /** Tab name for workbooks, file name for CSV. */
  name: string;
  /** Non-empty rows only, in order. */
  rows: SheetRow[];
  /** Workbooks saved by very old Mac Excel count dates from 1904. */
  date1904: boolean;
  /** True when the file had more non-empty rows than we were asked to read. */
  truncated: boolean;
}

/**
 * A problem with the file itself (wrong type, damaged, too big). The message
 * is written for the person uploading and is safe to show as-is.
 */
export class SpreadsheetFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpreadsheetFileError";
  }
}

export interface ReadOptions {
  /** Stop after this many non-empty rows and set `truncated`. */
  maxRows: number;
  /** Columns past this are ignored. */
  maxColumns: number;
}
