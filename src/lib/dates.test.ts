import { describe, expect, it } from "vitest";
import {
  companyToday,
  excelSerialToParts,
  fromCompanyWallTime,
  parseDateText,
  partsToExcelSerial,
} from "./dates";

describe("parseDateText", () => {
  it.each([
    ["2026-10-13", { year: 2026, month: 10, day: 13 }],
    ["10/13/2026", { year: 2026, month: 10, day: 13 }],
    ["10/13/26", { year: 2026, month: 10, day: 13 }],
    ["Oct 13, 2026", { year: 2026, month: 10, day: 13 }],
    ["Sept 3 2026", { year: 2026, month: 9, day: 3 }],
    ["13 October 2026", { year: 2026, month: 10, day: 13 }],
  ])("reads %s", (text, expected) => {
    expect(parseDateText(text)).toEqual(expected);
  });

  it.each([
    ["10/13/2026 2:15 PM", 14, 15],
    ["10/13/2026 12:05 am", 0, 5],
    ["2026-10-13 09:30", 9, 30],
    // Outlook's "Sent:" line and Gmail's pasted header.
    ["Tuesday, October 13, 2026 9:12 AM", 9, 12],
    ["Tue, Oct 13, 2026 at 4:40 PM", 16, 40],
  ])("reads the time in %s", (text, hour, minute) => {
    expect(parseDateText(text)).toMatchObject({ year: 2026, month: 10, day: 13, hour, minute });
  });

  it.each(["13/10/2026", "2/30/2026", "1926-01-01", "Octopus 5, 2026", "next Tuesday", "10/13/2026 13:00 PM", ""])(
    "rejects %s",
    (text) => {
      expect(parseDateText(text)).toBeNull();
    },
  );
});

describe("Excel day counts", () => {
  it("reads whole days as dates and fractions as times", () => {
    expect(excelSerialToParts(46308)).toEqual({ year: 2026, month: 10, day: 13 });
    expect(excelSerialToParts(46308.59375)).toEqual({ year: 2026, month: 10, day: 13, hour: 14, minute: 15 });
  });

  it("handles workbooks that count from 1904", () => {
    expect(excelSerialToParts(46308 - 1462, true)).toEqual({ year: 2026, month: 10, day: 13 });
  });

  it("round-trips through the writer", () => {
    const parts = { year: 2026, month: 3, day: 8, hour: 9, minute: 45 };
    expect(excelSerialToParts(partsToExcelSerial(parts))).toEqual(parts);
  });

  it("rejects numbers that aren't plausible dates", () => {
    expect(excelSerialToParts(42)).toBeNull();
    expect(excelSerialToParts(-1)).toBeNull();
  });
});

describe("fromCompanyWallTime", () => {
  it("applies daylight saving time", () => {
    expect(fromCompanyWallTime({ year: 2026, month: 7, day: 1, hour: 9, minute: 0 }).toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(fromCompanyWallTime({ year: 2026, month: 12, day: 1, hour: 9, minute: 0 }).toISOString()).toBe("2026-12-01T14:00:00.000Z");
  });

  it("puts a bare date at midday", () => {
    expect(fromCompanyWallTime({ year: 2026, month: 12, day: 1 }).toISOString()).toBe("2026-12-01T17:00:00.000Z");
  });

  it("knows which day it is in New York", () => {
    expect(companyToday(new Date("2026-10-13T02:00:00Z"))).toBe("2026-10-12");
    expect(companyToday(new Date("2026-10-13T05:00:00Z"))).toBe("2026-10-13");
  });
});
