import { diffArrays } from "diff";

export type DiffKind = "equal" | "added" | "removed";

export interface DiffSegment {
  kind: DiffKind;
  text: string;
}

export interface WordDiff {
  segments: DiffSegment[];
  wordsAdded: number;
  wordsRemoved: number;
}

/**
 * Splits on whitespace but keeps it as tokens, so "5.99%." stays one word
 * and joining the tokens reproduces the input exactly.
 */
function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((token) => token.length > 0);
}

/**
 * Word-level diff between two versions of the copy, for the redline view.
 * Whole words change as a unit (like track changes in a word processor)
 * rather than jsdiff's default, which splits inside numbers like "5.99%".
 */
export function wordDiff(previous: string, next: string): WordDiff {
  const raw: DiffSegment[] = diffArrays(tokenize(previous), tokenize(next)).map((change) => ({
    kind: change.added ? "added" : change.removed ? "removed" : "equal",
    text: change.value.join(""),
  }));
  const segments = mergeAdjacent(groupReplacements(raw));

  return {
    segments,
    wordsAdded: countWords(segments, "added"),
    wordsRemoved: countWords(segments, "removed"),
  };
}

const isWhitespace = (s: DiffSegment) => s.kind === "equal" && /^\s+$/.test(s.text);

/**
 * The token diff happily matches the spaces *between* replaced words, which
 * renders "Guaranteed approval" → "Check your rate" as an unreadable
 * interleave. When a run of changes contains both removals and additions,
 * fold the in-between whitespace into both sides so the run reads as one
 * struck-through phrase followed by its replacement.
 */
function groupReplacements(raw: DiffSegment[]): DiffSegment[] {
  const out: DiffSegment[] = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i].kind === "equal") {
      out.push(raw[i++]);
      continue;
    }

    let end = i;
    while (
      end < raw.length &&
      (raw[end].kind !== "equal" ||
        (isWhitespace(raw[end]) && end + 1 < raw.length && raw[end + 1].kind !== "equal"))
    ) {
      end++;
    }
    const run = raw.slice(i, end);
    const hasBoth = run.some((s) => s.kind === "removed") && run.some((s) => s.kind === "added");

    if (hasBoth) {
      const side = (kind: DiffKind) =>
        run.filter((s) => s.kind === kind || s.kind === "equal").map((s) => s.text).join("");
      out.push(...trimSharedWhitespace(side("removed"), side("added")));
    } else {
      out.push(...run);
    }
    i = end;
  }
  return out;
}

/** Whitespace both sides share at their edges belongs to the unchanged text. */
function trimSharedWhitespace(removed: string, added: string): DiffSegment[] {
  const edge = (pattern: RegExp) => {
    const a = removed.match(pattern)![0];
    return a === added.match(pattern)![0] ? a : "";
  };
  const lead = edge(/^\s*/);
  const trail = edge(/\s*$/);
  const core = (text: string) => text.slice(lead.length, text.length - trail.length);

  return [
    { kind: "equal" as const, text: lead },
    { kind: "removed" as const, text: core(removed) },
    { kind: "added" as const, text: core(added) },
    { kind: "equal" as const, text: trail },
  ].filter((s) => s.text.length > 0);
}

function mergeAdjacent(segments: DiffSegment[]): DiffSegment[] {
  const out: DiffSegment[] = [];
  for (const segment of segments) {
    const last = out[out.length - 1];
    if (last?.kind === segment.kind) last.text += segment.text;
    else out.push({ ...segment });
  }
  return out;
}

function countWords(segments: DiffSegment[], kind: DiffKind): number {
  return segments
    .filter((s) => s.kind === kind)
    .reduce((sum, s) => sum + (s.text.match(/\S+/g)?.length ?? 0), 0);
}
