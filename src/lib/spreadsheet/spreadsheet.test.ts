import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { checkSpreadsheetFile, readSpreadsheet, SpreadsheetFileError } from ".";
import { parseCsv } from "./read-csv";
import { writeXlsx } from "./write-xlsx";

const OPTIONS = { preferredTab: "Reviews", maxRows: 100, maxColumns: 20 };

describe("xlsx round trip", () => {
  const workbook = writeXlsx([
    { name: "Notes", columns: [{ width: 10 }], rows: [["ignore me"]] },
    {
      name: "Reviews",
      columns: [{ width: 10 }, { width: 10 }, { width: 10 }],
      header: true,
      rows: [
        ["Name", "When", "Copy"],
        ["Fish & chips <promo>", 46308.5, "Line one\nLine “two”"],
        [],
        [null, 7, "Only B and C"],
      ],
    },
  ]);

  it("reads the preferred tab, keeping Excel's row numbers", () => {
    const sheet = readSpreadsheet("tracker.xlsx", workbook, OPTIONS);
    expect(sheet.name).toBe("Reviews");
    expect(sheet.rows).toEqual([
      { number: 1, cells: ["Name", "When", "Copy"] },
      { number: 2, cells: ["Fish & chips <promo>", 46308.5, "Line one\nLine “two”"] },
      { number: 4, cells: [null, 7, "Only B and C"] },
    ]);
  });

  it("falls back to the first tab", () => {
    expect(readSpreadsheet("t.xlsx", workbook, { ...OPTIONS, preferredTab: "Missing" }).name).toBe("Notes");
  });

  it("stops at the row limit and says so", () => {
    const sheet = readSpreadsheet("t.xlsx", workbook, { ...OPTIONS, maxRows: 2 });
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.truncated).toBe(true);
  });

  it("reads shared strings and prefixed tags written by other tools", () => {
    const ns = 'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    const file = zipSync({
      "xl/workbook.xml": strToU8(`<x:workbook ${ns} xmlns:r="r"><x:workbookPr date1904="1"/><x:sheets><x:sheet name="Data" sheetId="1" r:id="rId1"/></x:sheets></x:workbook>`),
      "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Type="http://x/worksheet" Target="/xl/worksheets/sheet1.xml"/></Relationships>'),
      "xl/sharedStrings.xml": strToU8(`<x:sst ${ns}><x:si><x:t>Plain</x:t></x:si><x:si><x:r><x:t>Rich </x:t></x:r><x:r><x:t>text_x000D_</x:t></x:r><x:rPh><x:t>ignored</x:t></x:rPh></x:si></x:sst>`),
      "xl/worksheets/sheet1.xml": strToU8(`<x:worksheet ${ns}><x:sheetData><x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="C1" t="s"><x:v>1</x:v></x:c><x:c r="D1" t="b"><x:v>1</x:v></x:c></x:row></x:sheetData></x:worksheet>`),
    });
    const sheet = readSpreadsheet("data.xlsx", file, OPTIONS);
    expect(sheet.date1904).toBe(true);
    expect(sheet.rows[0].cells).toEqual(["Plain", null, "Rich text\r", true]);
  });
});

describe("refusing files", () => {
  it.each([
    ["tracker.xls", 10, /older Excel format/],
    ["tracker.xlsm", 10, /macros/],
    ["tracker.numbers", 10, /Apple Numbers/],
    ["tracker.pdf", 10, /This file is a \.pdf/],
    ["tracker", 10, /no extension/],
    ["tracker.xlsx", 0, /empty/],
    ["tracker.xlsx", 3 * 1024 * 1024, /3\.0 MB, over the 2\.0 MB limit/],
  ])("%s (%i bytes)", (name, size, message) => {
    expect(checkSpreadsheetFile(name, size)).toMatch(message);
  });

  it("explains password-protected and old binary workbooks", () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]);
    expect(() => readSpreadsheet("t.xlsx", ole, OPTIONS)).toThrow(/password-protected/);
  });

  it("explains files that only pretend to be workbooks", () => {
    expect(() => readSpreadsheet("t.xlsx", strToU8("Name,Status\n"), OPTIONS)).toThrow(SpreadsheetFileError);
  });

  it("refuses parts that unzip to an unreasonable size", () => {
    const big = zipSync({ "xl/worksheets/sheet1.xml": new Uint8Array(31 * 1024 * 1024) });
    expect(() => readSpreadsheet("t.xlsx", big, OPTIONS)).toThrow(/far more data/);
  });
});

describe("csv", () => {
  it("handles quotes, embedded newlines and CRLF", () => {
    expect(parseCsv('a,"b, with comma","line\r\nbreak"\r\n"say ""hi""",,x\r\n')).toEqual([
      ["a", "b, with comma", "line\r\nbreak"],
      ['say "hi"', "", "x"],
    ]);
  });

  it("detects semicolon and tab separators from the header", () => {
    expect(parseCsv("Name;Status\nA;B")).toEqual([["Name", "Status"], ["A", "B"]]);
    expect(parseCsv("Name\tStatus\nA\tB")).toEqual([["Name", "Status"], ["A", "B"]]);
  });

  it("refuses a quote that never closes", () => {
    expect(() => parseCsv('a,"b\nc,d')).toThrow(SpreadsheetFileError);
  });

  it("decodes BOM-marked UTF-8, legacy Windows text and UTF-16", () => {
    const utf8 = new Uint8Array([0xef, 0xbb, 0xbf, ...strToU8("Café,ok\n")]);
    const cp1252 = new Uint8Array([0x43, 0x61, 0x66, 0xe9, 0x2c, 0x6f, 0x6b]);
    const utf16 = new Uint8Array([0xff, 0xfe, ...Array.from("Café\tok").flatMap((ch) => [ch.charCodeAt(0), 0])]);
    for (const bytes of [utf8, cp1252, utf16]) {
      expect(readSpreadsheet("t.csv", bytes, OPTIONS).rows[0].cells).toEqual(["Café", "ok"]);
    }
  });

  it("skips blank lines but keeps the line numbers", () => {
    const sheet = readSpreadsheet("t.csv", strToU8("Name\n\n,\nSecond\n"), OPTIONS);
    expect(sheet.rows.map((r) => r.number)).toEqual([1, 4]);
  });
});
