import { strToU8, zipSync } from "fflate";

/**
 * Writes the small, styled workbooks we hand out (the import template and its
 * filled-in example). Only what those need: text and number cells, a bold
 * header row, column widths and formats, a frozen header, and Excel's
 * dropdown/date validation so people pick allowed values instead of typing them.
 */

export type CellStyle = "default" | "header" | "date" | "dateTime" | "wrap" | "note";

const STYLE_INDEX: Record<CellStyle, number> = { default: 0, header: 1, date: 2, dateTime: 3, wrap: 4, note: 5 };

export interface WriteColumn {
  width: number;
  /** Format applied to the whole column, so values typed later pick it up too. */
  style?: CellStyle;
  /** Dropdown of allowed values. */
  list?: readonly string[];
  /** Only accept dates. */
  date?: boolean;
  /** Tooltip Excel shows when a cell in this column is selected. */
  prompt?: string;
}

export type WriteCell = string | number | { value: string | number; style: CellStyle } | null;

export interface WriteSheet {
  name: string;
  columns: WriteColumn[];
  rows: WriteCell[][];
  /** Keep row 1 visible while scrolling and style it as a header. */
  header?: boolean;
  /** How many rows the column validations cover, below the header. */
  validationRows?: number;
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function escapeXml(text: string): string {
  return text
    // Characters XML 1.0 can't contain at all.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function cellXml(cell: WriteCell, ref: string, columnStyle: CellStyle | undefined, isHeader: boolean): string {
  if (cell === null) return "";
  const { value, style } =
    typeof cell === "object" ? cell : { value: cell, style: isHeader ? "header" : (columnStyle ?? "default") };
  const s = STYLE_INDEX[style] ? ` s="${STYLE_INDEX[style]}"` : "";
  if (typeof value === "number") return `<c r="${ref}"${s}><v>${value}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function sheetXml(sheet: WriteSheet): string {
  const lastRow = 1 + (sheet.validationRows ?? 0);
  const cols = sheet.columns
    .map((c, i) => {
      const style = c.style ? ` style="${STYLE_INDEX[c.style]}"` : "";
      return `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"${style}/>`;
    })
    .join("");

  const rows = sheet.rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) => cellXml(cell, `${columnLetter(c)}${r + 1}`, sheet.columns[c]?.style, Boolean(sheet.header) && r === 0))
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");

  const validations = sheet.columns.flatMap((c, i) => {
    if (!c.list && !c.date && !c.prompt) return [];
    const range = `${columnLetter(i)}2:${columnLetter(i)}${lastRow}`;
    const prompt = c.prompt ? ` showInputMessage="1" prompt="${escapeXml(c.prompt)}"` : "";
    if (c.list) {
      return [
        `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Not on the list" error="Pick one of the options in the dropdown."${prompt} sqref="${range}"><formula1>"${escapeXml(c.list.join(","))}"</formula1></dataValidation>`,
      ];
    }
    if (c.date) {
      // 36526 is 1 Jan 2000 in Excel's day count.
      return [
        `<dataValidation type="date" operator="greaterThanOrEqual" allowBlank="1" showErrorMessage="1" errorTitle="Not a date" error="Enter a date, like 10/13/2026."${prompt} sqref="${range}"><formula1>36526</formula1></dataValidation>`,
      ];
    }
    return [`<dataValidation allowBlank="1"${prompt} sqref="${range}"/>`];
  });

  const views = sheet.header
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';

  return (
    `${XML_HEADER}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `${views}<sheetFormatPr defaultRowHeight="15"/>` +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${rows}</sheetData>` +
    (validations.length ? `<dataValidations count="${validations.length}">${validations.join("")}</dataValidations>` : "") +
    `<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>` +
    `</worksheet>`
  );
}

const STYLES_XML =
  `${XML_HEADER}<styleSheet xmlns="${NS_MAIN}">` +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="m/d/yyyy h:mm AM/PM"/></numFmts>' +
  '<fonts count="3">' +
  '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><i/><sz val="11"/><color rgb="FF5B6472"/><name val="Calibri"/><family val="2"/></font>' +
  "</fonts>" +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1F5E52"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="6">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
  '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

export function writeXlsx(sheets: WriteSheet[]): Uint8Array {
  const sheetEntries = sheets.map((s, i) => ({ ...s, file: `sheet${i + 1}.xml`, rel: `rId${i + 1}` }));
  const stylesRel = `rId${sheets.length + 1}`;

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheetEntries
          .map((s) => `<Override PartName="/xl/worksheets/${s.file}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join("") +
        "</Types>",
    ),
    "_rels/.rels": strToU8(
      `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
        "</Relationships>",
    ),
    "xl/workbook.xml": strToU8(
      `${XML_HEADER}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
        '<bookViews><workbookView activeTab="0"/></bookViews><sheets>' +
        sheetEntries.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="${s.rel}"/>`).join("") +
        "</sheets></workbook>",
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheetEntries.map((s) => `<Relationship Id="${s.rel}" Type="${NS_REL}/worksheet" Target="worksheets/${s.file}"/>`).join("") +
        `<Relationship Id="${stylesRel}" Type="${NS_REL}/styles" Target="styles.xml"/>` +
        "</Relationships>",
    ),
    "xl/styles.xml": strToU8(STYLES_XML),
  };
  for (const s of sheetEntries) files[`xl/worksheets/${s.file}`] = strToU8(sheetXml(s));

  return zipSync(files, { level: 6 });
}
