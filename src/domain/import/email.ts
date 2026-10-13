import { parseDateText, toCompanyDateTimeInput, toIsoDate, type DateParts } from "@/lib/dates";
import { LIMITS } from "@/lib/validation";
import type { Channel, ProductLine } from "../types";
import type { TrackerPerson } from "./tracker";

/**
 * Turning a review request from the compliance inbox into a draft submission.
 *
 * Everything here is a suggestion: the person importing sees every field
 * before anything is saved, and the server validates the result like any
 * other submission. So the goal is "right most of the time, obvious when
 * wrong", not perfect email parsing.
 */

export interface ParsedEmail {
  /** The From line as written: "Priya Raman <priya.raman@…>", a bare address, or "". */
  from: string;
  /** When it arrived, as a `datetime-local` value in company time. */
  receivedAt: string | null;
  subject: string;
  body: string;
  /** Message-ID header from a saved .eml file; pasted emails don't have one. */
  messageId: string;
}

export interface RemovedPart {
  label: string;
  text: string;
}

export interface EmailDraft {
  title: string;
  productLine: ProductLine | null;
  channel: Channel | null;
  targetLaunchDate: string | null;
  /** The copy, with greetings, sign-offs, signatures and earlier replies taken out. */
  body: string;
  /** The whole message body, so the person importing can undo the cleanup. */
  fullBody: string;
  removed: RemovedPart[];
  senderId: string | null;
  /** Set when the sender is known but can't be the submitter (e.g. a reviewer forwarded it). */
  senderNote: string | null;
  receivedAt: string | null;
  subject: string;
  messageId: string;
}

/* ------------------------------------------------------------------ */
/* Reading a pasted email                                              */
/* ------------------------------------------------------------------ */

const HEADER = /^\s*(from|sent|date|to|cc|bcc|subject|importance|attachments|reply-to)\s*:\s*(.*)$/i;
const THREAD_MARKER = /^\s*(?:-{2,}\s*(?:original message|forwarded message)\s*-{2,}|begin forwarded message:?|_{8,})\s*$/i;

function normalise(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[ \t]+$/gm, "");
}

/**
 * Splits a pasted email into its header lines and body. Outlook, Gmail and
 * Apple Mail all put From / Sent (or Date) / To / Subject on top when you
 * copy or forward a message. Without a From line plus a date or recipient we
 * treat everything as body, so copy that happens to start with
 * "Subject: …" is left alone.
 */
export function parsePastedEmail(text: string): ParsedEmail {
  const lines = normalise(text).split("\n");
  let i = 0;
  const skipBlank = () => {
    while (i < lines.length && lines[i].trim() === "") i++;
  };
  skipBlank();
  if (i < lines.length && THREAD_MARKER.test(lines[i])) {
    i++;
    skipBlank();
  }

  const start = i;
  const headers: Record<string, string> = {};
  while (i < lines.length) {
    const m = lines[i].match(HEADER);
    if (m) {
      headers[m[1].toLowerCase()] ??= m[2].trim();
      i++;
      continue;
    }
    // Outlook on the web leaves blank lines between header lines. A repeated
    // header after a gap is the copy's own "Subject:" line, not ours.
    if (lines[i].trim() === "" && Object.keys(headers).length > 0) {
      let j = i;
      while (j < lines.length && lines[j].trim() === "") j++;
      const next = j < lines.length ? lines[j].match(HEADER) : null;
      if (next && !(next[1].toLowerCase() in headers)) {
        i = j;
        continue;
      }
    }
    break;
  }

  const looksLikeEmail = Boolean(headers.from && (headers.sent || headers.date || headers.to));
  if (!looksLikeEmail) {
    return { from: "", receivedAt: null, subject: "", body: lines.slice(start).join("\n").trim(), messageId: "" };
  }
  return {
    from: headers.from,
    receivedAt: parseSentLine(headers.sent ?? headers.date ?? ""),
    subject: headers.subject ?? "",
    body: lines.slice(i).join("\n").trim(),
    messageId: "",
  };
}

/** "Tuesday, October 13, 2026 9:12 AM", "Tue, Oct 13, 2026 at 9:12 AM (2 days ago)", or RFC 2822. */
export function parseSentLine(value: string): string | null {
  const text = value.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (!text) return null;
  // An explicit offset or zone means the instant is unambiguous.
  if (/[+-]\d{4}$|\b(?:GMT|UTC|Z)$/i.test(text)) {
    const instant = new Date(text);
    return Number.isNaN(instant.getTime()) ? null : toCompanyDateTimeInput(instant);
  }
  const parts = parseDateText(text.replace(/\s+(?:E[SD]T|ET)$/i, ""));
  return parts ? toDateTimeInput(parts) : null;
}

function toDateTimeInput(parts: DateParts): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${toIsoDate(parts)}T${pad(parts.hour ?? 12)}:${pad(parts.minute ?? 0)}`;
}

/* ------------------------------------------------------------------ */
/* Taking the email apart                                              */
/* ------------------------------------------------------------------ */

const REPLY_LINE = /^\s*on\b.{6,200}\bwrote:\s*$/i;
const MOBILE_LINE = /^\s*(?:sent from my [\w ]{2,30}|sent from (?:outlook|mail|yahoo mail)(?: for [\w ]{2,20})?|get outlook for [\w ]{2,20})\.?\s*$/i;
const CONFIDENTIAL_LINE =
  /^\s*(?:confidential(?:ity)?(?: notice| note)?\s*:|this (?:e-?mail|message|communication)\b.{0,60}\bconfidential|the information (?:contained )?in this (?:e-?mail|message))/i;
const GREETING = /^(?:hi|hello|hey|dear|good (?:morning|afternoon|evening)|morning|afternoon)\b[^.\n]{0,40}[,!:.]?$/i;
const INTRO =
  /\b(?:below|attached|for (?:your )?review|please (?:review|take a look|approve|look over)|can you (?:please )?(?:review|take a look|look over|approve|check)|could you (?:please )?(?:review|take a look|look over|approve|check)|ready for (?:compliance|review|your review)|needs? (?:compliance|approval|a review)|here(?:'s| is) the)\b/i;
const SIGN_OFF =
  /^(?:thanks|thank you|thx|many thanks|best|regards|kind regards|best regards|warm regards|cheers|appreciate (?:it|you|the help)|let me know|happy to (?:chat|discuss|answer|jump on)|any questions)\b/i;

/** Where an earlier message starts: "On … wrote:", "-----Original Message-----", or an Outlook From/Sent block. */
function threadStart(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (THREAD_MARKER.test(line) || REPLY_LINE.test(line)) return i;
    // Gmail wraps long "On … wrote:" lines in two.
    if (/^\s*on\b/i.test(line) && i + 1 < lines.length && /\bwrote:\s*$/i.test(lines[i + 1]) && line.length < 200) return i;
    if (/^\s*from:\s*\S/i.test(line) && lines.slice(i + 1, i + 4).some((l) => /^\s*(?:sent|date):\s*\S/i.test(l))) return i;
    // A run of quoted lines that lasts to the end.
    if (/^\s*>/.test(line) && lines.slice(i).every((l) => l.trim() === "" || /^\s*>/.test(l))) return i;
  }
  return -1;
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

const meaningful = (text: string) => text.replace(/\s+/g, " ").trim().length;

/**
 * The copy is what's left once the request around it is removed. Each piece
 * we take out is recorded, so the screen can say exactly what was dropped.
 */
export function cleanEmailBody(body: string, senderName = ""): { body: string; removed: RemovedPart[] } {
  const removed: RemovedPart[] = [];
  const drop = (label: string, text: string) => {
    if (text.trim()) removed.push({ label, text: text.trim() });
  };

  let lines = normalise(body).split("\n");

  const thread = threadStart(lines);
  if (thread !== -1) {
    const above = lines.slice(0, thread).join("\n");
    const below = lines.slice(thread).join("\n");
    if (meaningful(stripRequest(above, senderName).body) >= 40) {
      lines = lines.slice(0, thread);
      drop("Earlier messages in the thread", below);
    } else {
      // The copy is in the forwarded or quoted part ("FYI, see below").
      const quoted = below
        .replace(/^[ \t]*> ?/gm, "")
        .replace(/^\s*on\b[^\n]{0,200}(?:\n[^\n]{0,200})?\bwrote:[ \t]*\n/i, "");
      const inner = parsePastedEmail(quoted);
      drop("Note above the forwarded email", above);
      lines = normalise(inner.body).split("\n");
      const nested = threadStart(lines);
      if (nested !== -1) {
        drop("Earlier messages in the thread", lines.slice(nested).join("\n"));
        lines = lines.slice(0, nested);
      }
    }
  }

  const signature = lines.findIndex((l) => /^--\s*$/.test(l));
  if (signature !== -1) {
    drop("Signature", lines.slice(signature + 1).join("\n"));
    lines = lines.slice(0, signature);
  }

  const confidential = lines.findIndex((l) => CONFIDENTIAL_LINE.test(l));
  if (confidential !== -1) {
    drop("Confidentiality notice", lines.slice(confidential).join("\n"));
    lines = lines.slice(0, confidential);
  }

  const mobile = lines.filter((l) => MOBILE_LINE.test(l));
  if (mobile.length) {
    drop("“Sent from” line", mobile.join("\n"));
    lines = lines.filter((l) => !MOBILE_LINE.test(l));
  }

  const request = stripRequest(lines.join("\n"), senderName);
  removed.push(...request.removed);
  // Listed top to bottom, the way they appeared in the email.
  removed.sort((a, b) => REMOVED_ORDER.indexOf(a.label) - REMOVED_ORDER.indexOf(b.label));
  return { body: request.body, removed };
}

const REMOVED_ORDER = [
  "Note above the forwarded email",
  "Note to compliance",
  "Sign-off",
  "“Sent from” line",
  "Signature",
  "Confidentiality notice",
  "Earlier messages in the thread",
];

/** Removes the greeting and note to compliance on top, and the sign-off below. */
function stripRequest(text: string, senderName: string): { body: string; removed: RemovedPart[] } {
  const paras = paragraphs(text);
  const removed: RemovedPart[] = [];
  const top: string[] = [];

  if (paras.length > 1 && GREETING.test(paras[0]) && !paras[0].includes("\n")) top.push(paras.shift()!);
  // A greeting on the same line as the request: "Hi Marcus, can you review the email below?"
  if (paras.length > 1 && paras[0].length < 300 && INTRO.test(paras[0])) top.push(paras.shift()!);
  if (top.length) removed.push({ label: "Note to compliance", text: top.join("\n\n") });

  const names = senderName
    .toLowerCase()
    .split(/\s+/)
    .filter((n) => n.length > 1);
  const isNameOnly = (p: string) => {
    const words = p.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
    return words.length > 0 && words.length <= 3 && names.length > 0 && words.every((w) => names.includes(w));
  };

  const bottom: string[] = [];
  for (let n = 0; n < 3 && paras.length > 1; n++) {
    const last = paras[paras.length - 1];
    const short = last.length < 200 && last.split("\n").length <= 5;
    if (short && (SIGN_OFF.test(last) || isNameOnly(last))) bottom.unshift(paras.pop()!);
    else break;
  }
  if (bottom.length) removed.push({ label: "Sign-off", text: bottom.join("\n\n") });

  return { body: paras.join("\n\n"), removed };
}

/* ------------------------------------------------------------------ */
/* Guesses                                                             */
/* ------------------------------------------------------------------ */

const REQUEST_PREFIXES =
  /^(?:for\s+(?:compliance\s+)?review|compliance\s+review|review\s+request|request\s+for\s+review|please\s+review|ready\s+for\s+review|approval\s+(?:needed|request)|urgent|action\s+required)\s*[:\-–—|]\s*/i;

/** "RE: FW: [Marketing] For review: Fall debt consolidation email" → "Fall debt consolidation email". */
export function titleFromSubject(subject: string): string {
  let title = subject.replace(/\s+/g, " ").trim();
  let previous;
  do {
    previous = title;
    title = title
      .replace(/^(?:re|fw|fwd|aw|wg|sv|tr)\s*(?:\[\d+\])?\s*:\s*/i, "")
      .replace(/^\[[^\]]{1,40}\]\s*/, "")
      .replace(REQUEST_PREFIXES, "")
      .trim();
  } while (title !== previous);
  if (title.length > LIMITS.titleMax) title = `${title.slice(0, LIMITS.titleMax - 1).replace(/\s+\S*$/, "")}…`;
  return title.length >= LIMITS.titleMin ? title : "";
}

const PRODUCT_HINTS: [ProductLine, RegExp][] = [
  ["mortgage_prequal", /\b(?:mortgage|home\s?loans?|home\s?buy\w*|prequal\w*|pre-?qualif\w*|nmls)\b/i],
  ["credit_card", /\b(?:credit\s+cards?|cards?|cash\s?back|balance\s+transfers?|rewards?|annual\s+fee|purchase\s+apr)\b/i],
  ["personal_loan", /\b(?:personal\s+loans?|debt\s+consolidation|consolidat\w*|loans?)\b/i],
];

// Email comes last: almost every request mentions "email" somewhere.
const CHANNEL_HINTS: [Channel, RegExp][] = [
  ["social", /\b(?:instagram|facebook|linkedin|tiktok|social(?:\s+post)?|tweet)\b/i],
  ["landing_page", /\b(?:landing\s+page|web\s?page|microsite)\b/i],
  ["display_ad", /\b(?:display\s+ads?|banners?|\d{3}\s?x\s?\d{2,3}|programmatic)\b/i],
  ["direct_mail", /\b(?:direct\s+mail|postcards?|mailers?|letters?)\b/i],
  ["email", /\b(?:e-?mail|subject\s+line|newsletter|preheader)\b/i],
];

function firstHint<T>(hints: [T, RegExp][], ...texts: string[]): T | null {
  for (const text of texts) {
    const hit = hints.find(([, re]) => re.test(text));
    if (hit) return hit[0];
  }
  return null;
}

export const guessProduct = (subject: string, body: string) => firstHint(PRODUCT_HINTS, subject, body);
export const guessChannel = (subject: string, body: string) => firstHint(CHANNEL_HINTS, subject, body);

const MONTH_DAY = String.raw`(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?`;
const NUMERIC_DATE = String.raw`\d{1,2}/\d{1,2}(?:/(?:\d{4}|\d{2}))?`;
const ISO_DATE = String.raw`\d{4}-\d{2}-\d{2}`;
const LAUNCH_PHRASE = new RegExp(
  String.raw`\b(?:launch(?:es|ing)?|go(?:es|ing)?\s+live|live\s+on|go(?:es|ing)?\s+out|send(?:s|ing)?\s+(?:on|date)|drop(?:s|ping)?|in[-\s]home|in\s+market|scheduled\s+for|publish(?:es|ing)?|post(?:s|ing)?\s+on)\b[^.\n]{0,30}?\b(${MONTH_DAY}|${NUMERIC_DATE}|${ISO_DATE})\b`,
  "i",
);

/**
 * "Launching 10/20", "goes live Oct 20th", "in-home Nov 3". A date without a
 * year means the next one coming up. Only dates a submission would accept
 * (today to a year out) are suggested.
 */
export function guessLaunchDate(text: string, today: string): string | null {
  const match = text.match(LAUNCH_PHRASE);
  if (!match) return null;
  const raw = match[1].replace(/(\d)(?:st|nd|rd|th)\b/i, "$1");
  const hasYear = raw.includes("/") ? raw.split("/").length === 3 : /\d{4}$/.test(raw);
  const year = Number(today.slice(0, 4));

  const resolve = (y: number) => {
    const text = hasYear ? raw : raw.includes("/") ? `${raw}/${y}` : `${raw}, ${y}`;
    const parts = parseDateText(text);
    return parts ? toIsoDate(parts) : null;
  };
  let date = resolve(year);
  if (date && !hasYear && date < today) date = resolve(year + 1);
  if (!date || date < today) return null;

  const latest = new Date(Date.parse(`${today}T00:00:00Z`) + LIMITS.launchWindowDays * 86_400_000).toISOString().slice(0, 10);
  return date <= latest ? date : null;
}

const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Who the email is from. The browser never gets staff email addresses, so
 * there `email` is absent and the address's local part ("priya.raman")
 * does the matching instead.
 */
export type EmailPerson = Omit<TrackerPerson, "email"> & { email?: string };

/** "Priya Raman <priya.raman@…>", "Raman, Priya", or just the address. */
export function matchSender<P extends EmailPerson>(from: string, people: P[]): P | null {
  const bracket = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const bare = from.trim();
  const name = bracket ? bracket[1] : bare.includes("@") ? "" : bare;
  const address = (bracket ? bracket[2] : bare.includes("@") ? bare : "").trim().toLowerCase();

  if (address) {
    const byEmail = people.find((p) => p.email?.toLowerCase() === address);
    if (byEmail) return byEmail;
  }
  const flipped = name.includes(",") ? name.split(",").reverse().join(" ") : "";
  const local = address.split("@")[0]?.replace(/[._-]+/g, " ") ?? "";
  for (const candidate of [name, flipped, local].map(normName).filter(Boolean)) {
    const byName = people.find((p) => normName(p.name) === candidate);
    if (byName) return byName;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Putting it together                                                 */
/* ------------------------------------------------------------------ */

export function draftFromEmail(email: ParsedEmail, people: EmailPerson[], today: string): EmailDraft {
  const sender = matchSender(email.from, people);
  const cleaned = cleanEmailBody(email.body, sender?.name ?? "");
  // If cleanup leaves too little to be copy, it guessed wrong; keep everything.
  const useCleaned = meaningful(cleaned.body) >= LIMITS.bodyMin;
  const context = `${email.subject}\n${email.body}`;

  return {
    title: titleFromSubject(email.subject),
    productLine: guessProduct(email.subject, email.body),
    channel: guessChannel(email.subject, email.body),
    targetLaunchDate: guessLaunchDate(context, today),
    body: useCleaned ? cleaned.body : email.body.trim(),
    fullBody: email.body.trim(),
    removed: useCleaned ? cleaned.removed : [],
    senderId: sender?.role === "submitter" ? sender.id : null,
    senderNote:
      sender && sender.role !== "submitter"
        ? `This email is from ${sender.name}, who's on the compliance team. Choose the marketing teammate who wrote the copy.`
        : null,
    receivedAt: email.receivedAt,
    subject: email.subject.trim().slice(0, 300),
    messageId: email.messageId.trim().slice(0, 300),
  };
}
