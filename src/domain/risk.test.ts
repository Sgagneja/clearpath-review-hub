import { describe, expect, it } from "vitest";
import { compareSeverity, highestSeverity, riskLevel, riskScore } from "./risk";
import type { Severity } from "./types";

const findings = (...severities: Severity[]) => severities.map((severity) => ({ severity }));

describe("riskScore", () => {
  it("is zero for clean copy", () => {
    expect(riskScore([])).toBe(0);
  });

  it("weights high=30, medium=15, low=5", () => {
    expect(riskScore(findings("high"))).toBe(30);
    expect(riskScore(findings("medium", "low"))).toBe(20);
    expect(riskScore(findings("high", "medium", "low"))).toBe(50);
  });

  it("caps at 100", () => {
    expect(riskScore(findings("high", "high", "high", "high"))).toBe(100);
  });
});

describe("riskLevel", () => {
  it.each([
    [0, "low"],
    [19, "low"],
    [20, "medium"],
    [49, "medium"],
    [50, "high"],
    [100, "high"],
  ] as const)("score %i is %s", (score, level) => {
    expect(riskLevel(score)).toBe(level);
  });

  it("puts one high finding at medium and two at high", () => {
    expect(riskLevel(riskScore(findings("high")))).toBe("medium");
    expect(riskLevel(riskScore(findings("high", "high")))).toBe("high");
  });
});

describe("severity ordering", () => {
  it("sorts most severe first", () => {
    const sorted = (["low", "high", "medium"] as Severity[]).sort(compareSeverity);
    expect(sorted).toEqual(["high", "medium", "low"]);
  });

  it("picks the highest severity, or null for none", () => {
    expect(highestSeverity(["low", "medium"])).toBe("medium");
    expect(highestSeverity([])).toBeNull();
  });
});
