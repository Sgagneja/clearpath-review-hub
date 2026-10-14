import { describe, expect, it } from "vitest";
import { CHANNELS, PRODUCT_LINES, PRODUCT_LINE_LABELS } from "../types";
import { applicableRules, runPrecheck } from "./engine";
import { runScenario, SCENARIOS, scenariosFor } from "./scenarios";

describe.each(PRODUCT_LINES)("%s test cases", (productLine) => {
  const cases = scenariosFor(productLine);
  const ruleIds = applicableRules(productLine).map((r) => r.id);

  it.each(cases.map((s) => [s.label, s] as const))("%s", (_, scenario) => {
    const { missed, unexpected } = runScenario(scenario);
    expect({ missed, unexpected }).toEqual({ missed: [], unexpected: [] });
  });

  it(`sets off every check that applies to ${PRODUCT_LINE_LABELS[productLine].toLowerCase()} copy`, () => {
    const covered = new Set(cases.flatMap((s) => s.expect));
    expect(ruleIds.filter((id) => !covered.has(id))).toEqual([]);
  });

  it("only expects checks that apply to the product", () => {
    expect(cases.flatMap((s) => s.expect).filter((id) => !ruleIds.includes(id))).toEqual([]);
  });

  it("includes clean copy that has to pass", () => {
    expect(cases.some((s) => s.expect.length === 0)).toBe(true);
  });
});

describe("test cases", () => {
  it("have unique ids", () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });

  it("get the same result whatever the channel", () => {
    const flagged = (s: (typeof SCENARIOS)[number], channel: (typeof CHANNELS)[number]) =>
      runPrecheck({ text: s.body, productLine: s.productLine, channel }).findings.map((f) => f.key);
    for (const scenario of SCENARIOS) {
      for (const channel of CHANNELS) {
        expect(flagged(scenario, channel), `${scenario.id} as ${channel}`).toEqual(flagged(scenario, scenario.channel));
      }
    }
  });

  it("report what was missed and what wasn't expected", () => {
    const [clean] = scenariosFor("personal_loan").filter((s) => s.expect.length === 0);
    const result = runScenario({ ...clean, expect: ["mortgage-nmls-id"], body: `${clean.body} Guaranteed approval.` });
    expect(result).toMatchObject({ ok: false, missed: ["mortgage-nmls-id"], unexpected: ["udaap-absolute-claim"] });
  });
});
