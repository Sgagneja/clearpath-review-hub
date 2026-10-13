import { strFromU8, unzipSync, type UnzipFileInfo } from "fflate";
import { SpreadsheetFileError, type CellValue, type ReadOptions, type Sheet, type SheetRow } from "./types";

/**
 * A deliberately small .xlsx reader: it pulls cell values out of one
 * worksheet and nothing else. No formulas are evaluated (Excel saves each
 * formula's last result, which is what we read), no macros, no external
 * links, no XML entity expansion, so a hostile file has nothing to trigger.
 *
 * An .xlsx file is a zip of XML parts. The ones that matter:
 *   xl/workbook.xml             tab names and order, 1900/1904 date system
 *   xl/_rels/workbook.xml.rels  which XML part holds each tab
 *   xl/sharedStrings.xml        text cells point into this list
 *   xl/worksheets/sheetN.xml    the cells
 */

/** Unzipped size cap per part. Generous for 500 rows of copy, far below a zip bomb. */
const MAX_PART_BYTES = 30 * 1024 * 1024;
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
// Old binary .xls files and password-protected workbooks are both OLE containers.
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((b, i) => bytes[i] === b);
}

// Some producers (the .NET Open XML SDK, for one) prefix every tag, e.g. <x:row>.
const NS = String.raw`(?:[\w.-]+:)?`;
const tag = (name: string) =>
  new RegExp(String.raw`<${NS}${name}\b([^>]*?)(?:\/>|>([\s\S]*?)<\/${NS}${name}>)`, "g");

function attr(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(String.raw`(?:^|\s)${NS}${name}="([^"]*)"`));
  return m ? decodeXml(m[1]) : undefined;
}

const XML_ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decodeXml(text: string): string {
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (whole, ref: string) => {
      if (ref[0] !== "#") return XML_ENTITIES[ref.toLowerCase()] ?? whole;
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    })
    // Office escapes characters XML can't carry as _xHHHH_ (e.g. _x000D_ for \r).
    .replace(/_x([0-9a-f]{4})_/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/** Concatenates the <t> runs of a string item, skipping phonetic guides. */
function richText(xml: string): string {
  const visible = xml.replace(new RegExp(String.raw`<${NS}rPh\b[\s\S]*?<\/${NS}rPh>`, "g"), "");
  let out = "";
  for (const m of visible.matchAll(tag("t"))) out += m[2] ?? "";
  return decodeXml(out);
}

/** "BC12" → zero-based column 54. */
function columnIndex(ref: string): number | null {
  const letters = ref.match(/^[A-Z]+/i)?.[0];
  if (!letters) return null;
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function resolveTarget(target: string): string {
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const parts: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment && segment !== ".") parts.push(segment);
  }
  return parts.join("/");
}

function unzip(bytes: Uint8Array): Record<string, Uint8Array> {
  let total = 0;
  let oversized = false;
  const wanted = (file: UnzipFileInfo) => {
    const name = file.name;
    const relevant =
      name === "xl/workbook.xml" ||
      name === "xl/_rels/workbook.xml.rels" ||
      name === "xl/sharedStrings.xml" ||
      (name.startsWith("xl/worksheets/") && name.endsWith(".xml"));
    if (!relevant) return false;
    // The declared size also caps how much fflate will inflate, so a part
    // that lies about its size comes out truncated rather than huge.
    total += file.originalSize;
    if (file.originalSize > MAX_PART_BYTES || total > MAX_TOTAL_BYTES) oversized = true;
    return !oversized;
  };

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: wanted });
  } catch {
    throw new SpreadsheetFileError("This workbook looks damaged, so we couldn't open it. Open it in Excel, save it again as .xlsx and re-upload.");
  }
  if (oversized) {
    throw new SpreadsheetFileError("This workbook holds far more data than a review tracker should. Remove extra tabs or columns and try again.");
  }
  return files;
}

interface WorkbookTab {
  name: string;
  path: string;
  hidden: boolean;
}

function readWorkbook(files: Record<string, Uint8Array>): { tabs: WorkbookTab[]; date1904: boolean } {
  const workbook = files["xl/workbook.xml"];
  const rels = files["xl/_rels/workbook.xml.rels"];
  if (!workbook || !rels) {
    throw new SpreadsheetFileError("This file isn't a standard Excel workbook. Open it in Excel and save it as “Excel Workbook (.xlsx)”.");
  }
  const workbookXml = strFromU8(workbook);
  const relsXml = strFromU8(rels);

  const targets = new Map<string, string>();
  for (const m of relsXml.matchAll(tag("Relationship"))) {
    const id = attr(m[1], "Id");
    const target = attr(m[1], "Target");
    const type = attr(m[1], "Type") ?? "";
    if (id && target && type.endsWith("/worksheet")) targets.set(id, resolveTarget(target));
  }

  const tabs: WorkbookTab[] = [];
  for (const m of workbookXml.matchAll(tag("sheet"))) {
    const name = attr(m[1], "name") ?? "";
    const relId = m[1].match(/(?:^|\s)[\w.-]+:id="([^"]*)"/)?.[1];
    const path = relId ? targets.get(relId) : undefined;
    // Chart sheets have no worksheet relationship and are skipped.
    if (path && files[path]) tabs.push({ name, path, hidden: (attr(m[1], "state") ?? "visible") !== "visible" });
  }
  const pr = workbookXml.match(new RegExp(String.raw`<${NS}workbookPr\b([^>]*)`))?.[1] ?? "";
  const date1904 = ["1", "true"].includes(attr(pr, "date1904") ?? "");
  return { tabs, date1904 };
}

function readSharedStrings(files: Record<string, Uint8Array>): string[] {
  const part = files["xl/sharedStrings.xml"];
  if (!part) return [];
  return Array.from(strFromU8(part).matchAll(tag("si")), (m) => richText(m[2] ?? ""));
}

function cellValue(attrs: string, inner: string, shared: string[]): CellValue {
  const type = attr(attrs, "t") ?? "n";
  if (type === "inlineStr") {
    const is = inner.match(tag("is"));
    return is ? richText(is[0]) : "";
  }
  const raw = inner.match(new RegExp(String.raw`<${NS}v>([\s\S]*?)<\/${NS}v>`))?.[1];
  if (raw === undefined || raw === "") return null;
  const v = decodeXml(raw);
  switch (type) {
    case "s":
      return shared[Number(v)] ?? "";
    case "b":
      return v === "1";
    case "str":
    case "e": // Error results like #N/A come through as text, so validation can name them.
    case "d": // ISO date text, written by a few non-Excel tools.
      return v;
    default: {
      const n = Number(v);
      return Number.isFinite(n) ? n : v;
    }
  }
}

function readRows(xml: string, shared: string[], options: ReadOptions): { rows: SheetRow[]; truncated: boolean } {
  const rows: SheetRow[] = [];
  let nextRow = 1;
  for (const rowMatch of xml.matchAll(tag("row"))) {
    const number = Number(attr(rowMatch[1], "r")) || nextRow;
    nextRow = number + 1;
    const cells: CellValue[] = [];
    let nextCol = 0;
    for (const c of (rowMatch[2] ?? "").matchAll(tag("c"))) {
      const ref = attr(c[1], "r");
      const col = (ref ? columnIndex(ref) : null) ?? nextCol;
      nextCol = col + 1;
      if (col >= options.maxColumns) continue;
      const value = cellValue(c[1], c[2] ?? "", shared);
      if (value !== null && value !== "") cells[col] = value;
    }
    if (cells.length === 0) continue;
    if (rows.length === options.maxRows) return { rows, truncated: true };
    rows.push({ number, cells: Array.from(cells, (v) => v ?? null) });
  }
  return { rows, truncated: false };
}

/**
 * Reads one tab: the one named `preferredTab` if it exists, otherwise the
 * first visible tab.
 */
export function readXlsx(bytes: Uint8Array, preferredTab: string, options: ReadOptions): Sheet {
  if (startsWith(bytes, OLE_MAGIC)) {
    throw new SpreadsheetFileError(
      "This is either an older Excel file (.xls) or a password-protected workbook. Remove any password, then in Excel choose File › Save As › “Excel Workbook (.xlsx)” and upload that.",
    );
  }
  if (!startsWith(bytes, ZIP_MAGIC)) {
    throw new SpreadsheetFileError("This file is named .xlsx but isn't an Excel workbook inside. Open it in Excel and save it as “Excel Workbook (.xlsx)”.");
  }

  const files = unzip(bytes);
  const { tabs, date1904 } = readWorkbook(files);
  const wanted = preferredTab.toLowerCase();
  const tab = tabs.find((t) => t.name.trim().toLowerCase() === wanted) ?? tabs.find((t) => !t.hidden);
  if (!tab) throw new SpreadsheetFileError("We couldn't find a tab with data in this workbook.");

  const { rows, truncated } = readRows(strFromU8(files[tab.path]), readSharedStrings(files), options);
  return { name: tab.name, rows, date1904, truncated };
}
