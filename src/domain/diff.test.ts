import { describe, expect, it } from "vitest";
import { wordDiff } from "./diff";

describe("wordDiff", () => {
  it("returns a single equal segment for identical text", () => {
    const diff = wordDiff("Terms apply.", "Terms apply.");
    expect(diff.segments).toEqual([{ kind: "equal", text: "Terms apply." }]);
    expect(diff.wordsAdded).toBe(0);
    expect(diff.wordsRemoved).toBe(0);
  });

  it("renders a replaced phrase as one removal followed by one addition", () => {
    const diff = wordDiff("Guaranteed approval in minutes.", "Check your rate in minutes.");
    expect(diff.segments).toEqual([
      { kind: "removed", text: "Guaranteed approval" },
      { kind: "added", text: "Check your rate" },
      { kind: "equal", text: " in minutes." },
    ]);
    expect(diff.wordsRemoved).toBe(2);
    expect(diff.wordsAdded).toBe(3);
  });

  it("changes whole words, never digits inside a number", () => {
    const diff = wordDiff("Rates from 5.99% today.", "Rates from 8.99% today.");
    expect(diff.segments).toEqual([
      { kind: "equal", text: "Rates from " },
      { kind: "removed", text: "5.99%" },
      { kind: "added", text: "8.99%" },
      { kind: "equal", text: " today." },
    ]);
  });

  it("keeps a pure insertion as a single addition", () => {
    const diff = wordDiff("Terms apply.", "Subject to credit approval. Terms apply.");
    expect(diff.segments).toEqual([
      { kind: "added", text: "Subject to credit approval. " },
      { kind: "equal", text: "Terms apply." },
    ]);
  });

  it("can rebuild both versions from the segments", () => {
    const before = "Rates as low as 5.99%. Act now!";
    const after = "APRs as low as 8.99% for well-qualified applicants. Offer ends Nov 30.";
    const { segments } = wordDiff(before, after);
    const rebuild = (skip: "added" | "removed") =>
      segments.filter((s) => s.kind !== skip).map((s) => s.text).join("");
    expect(rebuild("added")).toBe(before);
    expect(rebuild("removed")).toBe(after);
  });
});
