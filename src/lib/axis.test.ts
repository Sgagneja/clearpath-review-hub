import { describe, expect, it } from "vitest";
import { niceAxis } from "./axis";

describe("niceAxis", () => {
  it("uses whole-number steps that land exactly on the top", () => {
    expect(niceAxis(6)).toEqual({ top: 6, ticks: [2, 4, 6] });
    expect(niceAxis(13)).toEqual({ top: 15, ticks: [5, 10, 15] });
    expect(niceAxis(40)).toEqual({ top: 40, ticks: [10, 20, 30, 40] });
  });

  it("never produces fractional ticks for small counts", () => {
    expect(niceAxis(1)).toEqual({ top: 1, ticks: [1] });
    expect(niceAxis(3)).toEqual({ top: 3, ticks: [1, 2, 3] });
  });

  it("treats an empty chart as a 0–1 axis", () => {
    expect(niceAxis(0)).toEqual({ top: 1, ticks: [1] });
  });
});
