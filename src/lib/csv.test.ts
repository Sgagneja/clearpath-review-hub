import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv } from "./csv";

describe("escapeCsvCell", () => {
  it("leaves ordinary text alone", () => {
    expect(escapeCsvCell("Approved by Marcus Bell")).toBe("Approved by Marcus Bell");
  });

  it("quotes cells containing commas, quotes or newlines", () => {
    expect(escapeCsvCell("Hello, world")).toBe('"Hello, world"');
    expect(escapeCsvCell('Say "approved"')).toBe('"Say ""approved"""');
    expect(escapeCsvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  describe("formula injection", () => {
    it.each([
      ["=HYPERLINK(\"http://evil.example\",\"Click\")"],
      ["+1+cmd|' /C calc'!A0"],
      ["-2+3"],
      ["@SUM(A1:A9)"],
      ["\t=1+1"],
      ["\r=1+1"],
      ["   =1+1"],
    ])("neutralises %j", (payload) => {
      const cell = escapeCsvCell(payload);
      // Wrapped in quotes and prefixed with an apostrophe: Excel shows it as text.
      expect(cell.startsWith(`"'`)).toBe(true);
      expect(cell.endsWith('"')).toBe(true);
    });

    it("doesn't touch formula characters that aren't at the start", () => {
      expect(escapeCsvCell("a=b")).toBe("a=b");
      expect(escapeCsvCell("user@example.com")).toBe("user@example.com");
    });
  });

  it("serialises non-string values", () => {
    expect(escapeCsvCell(-12)).toBe("-12");
    expect(escapeCsvCell(true)).toBe("true");
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell(new Date("2026-10-01T09:30:00Z"))).toBe("2026-10-01T09:30:00.000Z");
  });
});

describe("toCsv", () => {
  it("writes a BOM, a header row and CRLF-separated rows", () => {
    const csv = toCsv(["id", "note"], [
      ["MKT-1001", "ok"],
      ["MKT-1002", "=cmd"],
    ]);
    expect(csv).toBe('\uFEFFid,note\r\nMKT-1001,ok\r\nMKT-1002,"\'=cmd"\r\n');
  });
});
