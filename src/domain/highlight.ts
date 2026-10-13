import { highestSeverity } from "./risk";
import type { Finding, Severity } from "./types";

export interface HighlightSegment {
  text: string;
  start: number;
  end: number;
  /** Indexes into the findings array of every finding covering this span. */
  findingIndexes: number[];
  /** Colour to render with: the most severe covering finding, or null. */
  severity: Severity | null;
  /** True for the first segment of a match, where the footnote marker goes. */
  isMatchStart: boolean;
}

/**
 * Splits `text` into contiguous segments so that overlapping findings can be
 * rendered as flat, non-nested <mark> elements. Concatenating every segment's
 * `text` reproduces the input exactly.
 */
export function segmentText(text: string, findings: Finding[]): HighlightSegment[] {
  const spans = findings.flatMap((finding, index) =>
    finding.matches
      .map((m) => ({
        start: clamp(m.start, text.length),
        end: clamp(m.end, text.length),
        index,
      }))
      .filter((s) => s.end > s.start),
  );

  const boundaries = new Set<number>([0, text.length]);
  for (const s of spans) {
    boundaries.add(s.start);
    boundaries.add(s.end);
  }
  const points = [...boundaries].sort((a, b) => a - b);

  const segments: HighlightSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    const covering = spans.filter((s) => s.start <= start && s.end >= end);
    const findingIndexes = [...new Set(covering.map((s) => s.index))].sort((a, b) => a - b);
    segments.push({
      text: text.slice(start, end),
      start,
      end,
      findingIndexes,
      severity: highestSeverity(findingIndexes.map((idx) => findings[idx].severity)),
      isMatchStart: covering.some((s) => s.start === start),
    });
  }
  return segments;
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(0, value), max);
}
