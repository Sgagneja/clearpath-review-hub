import { describe, expect, it } from "vitest";
import { STATUSES } from "./types";
import {
  availableTransitions,
  canTransition,
  InvalidTransitionError,
  isTerminal,
  stageOf,
  transition,
} from "./workflow";

describe("workflow state machine", () => {
  it("walks the happy path from submission to approval", () => {
    const inReview = transition("submitted", "start_review");
    expect(inReview).toBe("in_review");
    expect(transition(inReview, "approve")).toBe("approved");
  });

  it("loops a revision back to submitted", () => {
    const sentBack = transition("in_review", "request_changes");
    expect(sentBack).toBe("changes_requested");
    expect(transition(sentBack, "resubmit")).toBe("submitted");
  });

  it.each([
    ["submitted", "approve"],
    ["submitted", "resubmit"],
    ["in_review", "start_review"],
    ["in_review", "resubmit"],
    ["changes_requested", "approve"],
    ["approved", "reject"],
    ["approved", "resubmit"],
    ["rejected", "start_review"],
  ] as const)("refuses %s → %s", (from, attempted) => {
    expect(() => transition(from, attempted)).toThrow(InvalidTransitionError);
    expect(canTransition(from, attempted)).toBe(false);
  });

  it("describes the illegal move in the error", () => {
    expect(() => transition("approved", "reject")).toThrow(
      'Cannot "reject" a submission that is "approved".',
    );
  });

  it("treats only approved and rejected as terminal", () => {
    const terminal = STATUSES.filter(isTerminal);
    expect(terminal).toEqual(["approved", "rejected"]);
    expect(availableTransitions("in_review")).toEqual(["approve", "request_changes", "reject"]);
  });

  it("maps statuses onto the three tracker stages", () => {
    expect(stageOf("submitted")).toBe("submitted");
    expect(stageOf("in_review")).toBe("in_review");
    expect(stageOf("changes_requested")).toBe("decision");
    expect(stageOf("rejected")).toBe("decision");
  });
});
