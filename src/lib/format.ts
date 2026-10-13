/**
 * Display formatting. Absolute times render in a single company time zone so
 * server-rendered HTML is identical for every viewer (no hydration drift) and
 * matches the times compliance quotes in their SLAs.
 */

export const APP_TIME_ZONE = "America/New_York";
export const APP_TIME_ZONE_LABEL = "ET";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

const shortDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "short",
  day: "numeric",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

export function formatShortDate(date: Date): string {
  return shortDateFormat.format(date);
}

export function formatDateTime(date: Date): string {
  return `${dateTimeFormat.format(date)} ${APP_TIME_ZONE_LABEL}`;
}

/** A date-only string (YYYY-MM-DD) shown as a calendar date, no TZ shift. */
export function formatCalendarDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact duration: "45m", "6h", "2d 4h". Sign is ignored. */
export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < HOUR) return `${Math.max(1, Math.round(abs / MINUTE))}m`;
  if (abs < DAY) return `${Math.round(abs / HOUR)}h`;
  const days = Math.floor(abs / DAY);
  const hours = Math.round((abs - days * DAY) / HOUR);
  return hours === 0 || hours === 24 ? `${days + (hours === 24 ? 1 : 0)}d` : `${days}d ${hours}h`;
}

export function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  return formatDuration(hours * HOUR);
}

/** "in 6h" / "3h ago" relative to `now`. */
export function formatRelative(date: Date, now: Date): string {
  const diff = date.getTime() - now.getTime();
  if (Math.abs(diff) < MINUTE) return "just now";
  return diff > 0 ? `in ${formatDuration(diff)}` : `${formatDuration(diff)} ago`;
}

export function formatPercent(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
