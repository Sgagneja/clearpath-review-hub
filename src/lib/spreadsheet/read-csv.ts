import { SpreadsheetFileError, type ReadOptions, type Sheet, type SheetRow } from "./types";

/**
 * CSV as Excel actually writes it: UTF-8 with or without a BOM, the older
 * Windows encoding ("CSV (Comma delimited)"), UTF-16 ("Unicode Text"), and
 * semicolons or tabs instead of commas depending on regional settings.
 */

function decode(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  const body = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    // Not valid UTF-8: Excel on Windows saved it in the legacy Western encoding.
    return new TextDecoder("windows-1252").decode(body);
  }
}

/** The separator that splits the header line into the most columns. */
function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  return counts.reduce((best, c) => (c[1] > best[1] ? c : best))[0];
}

/** RFC 4180: quoted fields may contain the delimiter, newlines and doubled quotes. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (ch === '"') quoted = false;
      else field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
    } else {
      field += ch;
    }
    i += 1;
  }
  if (quoted) {
    throw new SpreadsheetFileError("This CSV has a quotation mark that never closes, so its rows can't be told apart. Re-save it from Excel and try again.");
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

export function readCsv(bytes: Uint8Array, name: string, options: ReadOptions): Sheet {
  const records = parseCsv(decode(bytes));
  const rows: SheetRow[] = [];
  let truncated = false;
  for (const [index, record] of records.entries()) {
    const cells = record.slice(0, options.maxColumns).map((c) => (c.trim() === "" ? null : c));
    if (cells.every((c) => c === null)) continue;
    if (rows.length === options.maxRows) {
      truncated = true;
      break;
    }
    // Rows are counted by record, which is what Excel shows when it opens the file.
    rows.push({ number: index + 1, cells });
  }
  return { name, rows, date1904: false, truncated };
}
