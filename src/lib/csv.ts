/**
 * RFC 4180 CSV writer that is safe to open in Excel.
 *
 * Audit exports end up in spreadsheets on an examiner's laptop, and every cell
 * contains text a user typed. A cell starting with `=`, `+`, `-`, `@`, tab or
 * carriage return is executed as a formula by Excel/Sheets ("CSV injection"),
 * so we neutralise those by prefixing a single quote, per OWASP guidance.
 */

export type CsvValue = string | number | boolean | Date | null | undefined;

const FORMULA_TRIGGER = /^[\s]*[=+\-@\t\r]/;
const NEEDS_QUOTING = /[",\r\n]/;

export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  // Numbers and booleans can't carry a payload; leave "-12" as a number.
  if (typeof value !== "string") return String(value);

  let cell = value;
  if (FORMULA_TRIGGER.test(cell)) cell = `'${cell}`;
  if (NEEDS_QUOTING.test(cell) || cell !== value) {
    cell = `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/** Joins rows with CRLF and prepends a BOM so Excel detects UTF-8. */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
