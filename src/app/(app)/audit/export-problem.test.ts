import { describe, expect, it } from "vitest";
import { EXPORT_PROBLEMS, exportProblemMessage } from "./export-problem";

describe("exportProblemMessage", () => {
  it("turns each known code into its sentence", () => {
    for (const [code, message] of Object.entries(EXPORT_PROBLEMS)) {
      expect(exportProblemMessage(code)).toBe(message);
    }
  });

  it("ignores anything else, so the URL can't put its own words on the page", () => {
    expect(exportProblemMessage(undefined)).toBeNull();
    expect(exportProblemMessage("")).toBeNull();
    expect(exportProblemMessage("Your account is locked, call 555-0100")).toBeNull();
    expect(exportProblemMessage("toString")).toBeNull();
    expect(exportProblemMessage("__proto__")).toBeNull();
  });
});
