import { APP_TIME_ZONE } from "./format";

/**
 * Reading dates the way people actually write them in trackers and emails,
 * and turning wall-clock times in the company time zone into instants.
 *
 * Imports are the only place dates arrive as free text, so the accepted
 * formats are deliberately few and unambiguous for a US team: ISO
 * (2026-10-13), US numeric (10/13/2026, month first) and written out
 * (Oct 13, 2026 / 13 October 2026 / Tuesday, October 13, 2026 9:12 AM).
 */

export interface DateParts {
  year: number;
  month: number;
  day: number;
  /** Present only when the source carried a time of day. */
  hour?: number;
  minute?: number;
}

/** Imports outside this window are almost certainly typos (e.g. 1926, 2206). */
export const EARLIEST_YEAR = 2000;
export const LATEST_YEAR = 2100;

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** "Oct", "Sept" and "October" all work; "Octo-ber" and "Octopus" don't. */
function monthFromName(name: string): number | null {
  const key = name.toLowerCase();
  const index = MONTHS.findIndex((month) => month.startsWith(key));
  return index === -1 || key.length < 3 ? null : index + 1;
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (year < EARLIEST_YEAR || year > LATEST_YEAR || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function to24h(hour: number, meridiem: string | undefined): number | null {
  if (!meridiem) return hour <= 23 ? hour : null;
  if (hour < 1 || hour > 12) return null;
  const pm = meridiem.toLowerCase() === "pm";
  return (hour % 12) + (pm ? 12 : 0);
}

const TIME = String.raw`(?:,?\s+(?:at\s+)?(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]m)?)?`;
const PATTERNS: { re: RegExp; parts: (m: RegExpMatchArray) => [number, number | null, number] }[] = [
  // 2026-10-13, 2026-10-13 14:05, 2026-10-13T14:05
  { re: new RegExp(String.raw`^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*([ap]m)?)?$`, "i"), parts: (m) => [+m[1], +m[2], +m[3]] },
  // 10/13/2026, 10/13/26, 10-13-2026 (month first)
  { re: new RegExp(String.raw`^(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})${TIME}$`, "i"), parts: (m) => [m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]] },
  // Oct 13, 2026 · Tuesday, October 13, 2026 9:12 AM
  { re: new RegExp(String.raw`^(?:[a-z]+,?\s+)?([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})${TIME}$`, "i"), parts: (m) => [+m[3], monthFromName(m[1]), +m[2]] },
  // 13 Oct 2026 · Tue, 13 Oct 2026 09:12
  { re: new RegExp(String.raw`^(?:[a-z]+,?\s+)?(\d{1,2})\s+([a-z]{3,9})\.?,?\s+(\d{4})${TIME}$`, "i"), parts: (m) => [+m[3], monthFromName(m[2]), +m[1]] },
];

/** Parses a typed date (and optional time). Returns null for anything else. */
export function parseDateText(input: string): DateParts | null {
  const text = input.trim().replace(/\s+/g, " ");
  for (const { re, parts } of PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const [year, month, day] = parts(m);
    if (month === null || !isRealDate(year, month, day)) return null;
    // The time groups are always the last three captures of each pattern.
    const [hourText, minuteText, meridiem] = m.slice(-3);
    if (hourText === undefined) return { year, month, day };
    const hour = to24h(+hourText, meridiem);
    const minute = +minuteText;
    if (hour === null || minute > 59) return null;
    return { year, month, day, hour, minute };
  }
  return null;
}

const DAY_MS = 86_400_000;
// Excel counts days from 1899-12-30 (the 1900 system, with Lotus' leap-year
// bug folded in) or from 1904-01-01 (old Mac workbooks).
const EXCEL_EPOCH_1900 = Date.UTC(1899, 11, 30);
const EXCEL_EPOCH_1904 = Date.UTC(1904, 0, 1);

/** Excel stores dates as day counts; the fraction is the time of day. */
export function excelSerialToParts(serial: number, date1904 = false): DateParts | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const ms = Math.round(((date1904 ? EXCEL_EPOCH_1904 : EXCEL_EPOCH_1900) + serial * DAY_MS) / 60_000) * 60_000;
  const d = new Date(ms);
  const parts: DateParts = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  if (!isRealDate(parts.year, parts.month, parts.day)) return null;
  if (!Number.isInteger(serial)) {
    parts.hour = d.getUTCHours();
    parts.minute = d.getUTCMinutes();
  }
  return parts;
}

/** Inverse of `excelSerialToParts`, for writing the example workbook. */
export function partsToExcelSerial(parts: DateParts): number {
  const ms = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0);
  return (ms - EXCEL_EPOCH_1900) / DAY_MS;
}

export function toIsoDate(parts: DateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

const zoneParts = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** How far the company time zone is from UTC at `instant`, in ms (negative for ET). */
function zoneOffsetMs(instant: number): number {
  const p = Object.fromEntries(zoneParts.formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - instant;
}

/**
 * The instant a wall-clock time in the company time zone refers to, with
 * daylight saving handled. Times without an hour default to midday, which
 * keeps a bare date on the same calendar day in every US time zone.
 */
export function fromCompanyWallTime(parts: DateParts): Date {
  const naive = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour ?? 12, parts.minute ?? 0);
  // Two passes settle the offset even when the guess lands across a DST change.
  const first = naive - zoneOffsetMs(naive);
  return new Date(naive - zoneOffsetMs(first));
}

function companyParts(instant: Date) {
  const p = Object.fromEntries(zoneParts.formatToParts(instant).map((x) => [x.type, x.value.padStart(2, "0")]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Today's calendar date in the company time zone, as YYYY-MM-DD. */
export function companyToday(now = new Date()): string {
  return companyParts(now).date;
}

/** An instant as the value of a `datetime-local` input, in company time. */
export function toCompanyDateTimeInput(instant: Date): string {
  const { date, time } = companyParts(instant);
  return `${date}T${time}`;
}
