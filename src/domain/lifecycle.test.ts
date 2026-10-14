import { describe, expect, it } from "vitest";
import { lifecycleSteps, type LifecycleInput, type LifecycleRound } from "./lifecycle";

const at = (hours: number) => new Date(Date.UTC(2026, 9, 5, 9) + hours * 3_600_000);

function round(version: number, overrides: Partial<LifecycleRound> = {}): LifecycleRound {
  return {
    version,
    findingCount: 3,
    riskLevel: "medium",
    submittedBy: "Priya Shah",
    submittedAt: at(version * 24),
    reviewStartedAt: null,
    reviewer: null,
    decidedAt: null,
    decidedBy: null,
    outcome: null,
    ...overrides,
  };
}

function input(overrides: Partial<LifecycleInput>): LifecycleInput {
  return { status: "submitted", rounds: [round(1)], assignee: null, targetLaunchDate: "2026-10-20", launchAtRisk: false, ...overrides };
}

const labels = (i: LifecycleInput) => lifecycleSteps(i).map((s) => s.label);

describe("lifecycleSteps", () => {
  it("shows a new submission waiting, with what's still to come", () => {
    const steps = lifecycleSteps(input({}));
    expect(steps.map((s) => [s.label, s.state])).toEqual([
      ["Submitted", "done"],
      ["Version 1 waiting for a reviewer", "current"],
      ["Decision", "upcoming"],
      ["Launch", "upcoming"],
    ]);
    expect(steps[0].note).toBe("Pre-check: 3 findings, medium risk");
    expect(steps[1].by).toBe("Not assigned yet");
  });

  it("names the reviewer once the review starts", () => {
    const steps = lifecycleSteps(
      input({ status: "in_review", assignee: "Marcus Bell", rounds: [round(1, { reviewStartedAt: at(30), reviewer: "Marcus Bell" })] }),
    );
    expect(steps[1]).toMatchObject({ label: "Version 1 in review", by: "Marcus Bell", at: at(30), state: "current" });
  });

  it("adds a marketing step after copy is sent back, and pauses the deadline", () => {
    const sentBack = round(1, { decidedAt: at(40), decidedBy: "Marcus Bell", outcome: "changes_requested" });
    const steps = lifecycleSteps(input({ status: "changes_requested", rounds: [sentBack] }));
    expect(steps.map((s) => s.label)).toEqual(["Submitted", "Version 1 sent back", "Back with marketing", "Decision", "Launch"]);
    expect(steps[1]).toMatchObject({ tone: "warning", state: "done" });
    expect(steps[2]).toMatchObject({ state: "current", by: "Priya Shah", note: "Review deadline paused until it comes back" });
  });

  it("gives every round its own step, with that version's pre-check", () => {
    const steps = lifecycleSteps(
      input({
        status: "approved",
        rounds: [
          round(1, { decidedAt: at(40), decidedBy: "Marcus Bell", outcome: "changes_requested" }),
          round(2, { findingCount: 0, decidedAt: at(60), decidedBy: "Marcus Bell", outcome: "approved" }),
        ],
      }),
    );
    expect(steps.map((s) => s.label)).toEqual(["Submitted", "Version 1 sent back", "Version 2 approved", "Cleared to launch"]);
    expect(steps[2].note).toBe("Pre-check: nothing flagged");
    expect(steps[3]).toMatchObject({ state: "done", tone: "positive", day: "2026-10-20" });
  });

  it("ends a rejection without a launch date", () => {
    const rejected = round(1, { decidedAt: at(40), decidedBy: "Dana Okafor", outcome: "rejected" });
    const steps = lifecycleSteps(input({ status: "rejected", rounds: [rejected] }));
    expect(steps.at(-1)).toMatchObject({ label: "Not launching", day: null, state: "upcoming" });
    expect(steps[1].tone).toBe("negative");
  });

  it("warns on the launch step when the deadline lands on or after launch day", () => {
    expect(lifecycleSteps(input({ launchAtRisk: true })).at(-1)).toMatchObject({ tone: "warning", note: expect.stringContaining("At risk") });
  });

  it("falls back to the reviewer when imported history doesn't say who decided", () => {
    const imported = round(1, { reviewer: "Alana Reyes", decidedAt: at(40), outcome: "approved" });
    expect(lifecycleSteps(input({ status: "approved", rounds: [imported] }))[1].by).toBe("Alana Reyes");
  });

  it("has nothing to show without a version", () => {
    expect(labels(input({ rounds: [] }))).toEqual([]);
  });
});
