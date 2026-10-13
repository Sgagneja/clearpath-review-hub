import type { TextMatch } from "../types";

/** Every non-empty match of `pattern` in `text`, with offsets. */
export function findAll(text: string, pattern: RegExp): TextMatch[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  const matches: TextMatch[] = [];
  for (const m of text.matchAll(re)) {
    if (m[0].length === 0 || m.index === undefined) continue;
    matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return matches;
}

/** Stateless `test()`: a shared /g regex would otherwise carry `lastIndex`. */
export function contains(text: string, pattern: RegExp): boolean {
  return new RegExp(pattern.source, pattern.flags.replace("g", "")).test(text);
}

export function textBefore(text: string, match: TextMatch, chars: number): string {
  return text.slice(Math.max(0, match.start - chars), match.start);
}

export function textAfter(text: string, match: TextMatch, chars: number): string {
  return text.slice(match.end, match.end + chars);
}

export function textAround(text: string, match: TextMatch, before: number, after: number) {
  return text.slice(Math.max(0, match.start - before), match.end + after);
}

/** Lower-cased, whitespace-collapsed form of a phrase, for grouping. */
export function normalizePhrase(phrase: string): string {
  return phrase.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

/** Sorted by position, with exact duplicates and overlaps removed. */
export function dedupeMatches(matches: TextMatch[]): TextMatch[] {
  const sorted = [...matches].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: TextMatch[] = [];
  for (const m of sorted) {
    const last = out[out.length - 1];
    if (last && m.start < last.end) continue;
    out.push(m);
  }
  return out;
}

export function groupByPhrase(matches: TextMatch[]): Map<string, TextMatch[]> {
  const groups = new Map<string, TextMatch[]>();
  for (const m of matches) {
    const key = normalizePhrase(m.text);
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return groups;
}

/** "a", "a and b", "a, b and c" — for readable finding messages. */
export function listPhrases(phrases: string[]): string {
  const quoted = [...new Set(phrases)].map((p) => `“${p}”`);
  if (quoted.length <= 1) return quoted.join("");
  return `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
}
