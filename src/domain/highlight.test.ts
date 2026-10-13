import { describe, expect, it } from "vitest";
import { segmentText } from "./highlight";
import type { Finding, Severity, TextMatch } from "./types";

const finding = (severity: Severity, ...matches: [number, number][]): Finding => ({
  key: `k-${severity}-${matches.length}`,
  ruleId: "r",
  title: "t",
  severity,
  category: "claim",
  citation: "c",
  message: "m",
  suggestion: "s",
  matches: matches.map(([start, end]): TextMatch => ({ start, end, text: "" })),
});

describe("segmentText", () => {
  const text = "Guaranteed approval, no credit check.";

  it("returns the whole text as one plain segment when nothing matched", () => {
    expect(segmentText(text, [])).toEqual([
      { text, start: 0, end: text.length, findingIndexes: [], severity: null, isMatchStart: false },
    ]);
  });

  it("always reassembles to the original text", () => {
    const segments = segmentText(text, [finding("high", [0, 19]), finding("medium", [21, 36])]);
    expect(segments.map((s) => s.text).join("")).toBe(text);
  });

  it("splits overlapping matches into flat segments, coloured by the worst finding", () => {
    // "Guaranteed approval" (high) overlaps "approval, no" (low)
    const segments = segmentText(text, [finding("high", [0, 19]), finding("low", [11, 23])]);
    expect(segments.map((s) => [s.text, s.findingIndexes, s.severity])).toEqual([
      ["Guaranteed ", [0], "high"],
      ["approval", [0, 1], "high"],
      [", no", [1], "low"],
      [" credit check.", [], null],
    ]);
  });

  it("marks only the first segment of each match as its start", () => {
    const segments = segmentText(text, [finding("high", [0, 19]), finding("low", [11, 23])]);
    expect(segments.map((s) => s.isMatchStart)).toEqual([true, true, false, false]);
  });

  it("clamps out-of-range offsets instead of throwing", () => {
    const segments = segmentText("short", [finding("low", [2, 999])]);
    expect(segments.map((s) => s.text)).toEqual(["sh", "ort"]);
  });

  it("ignores findings with nothing to highlight", () => {
    expect(segmentText(text, [finding("medium")])).toHaveLength(1);
  });
});
