import { describe, expect, it } from "vitest";
import {
  assertCan,
  authorize,
  can,
  ForbiddenError,
  isEligibleAssignee,
  type Actor,
  type SubmissionScope,
} from "./permissions";

const priya: Actor = { id: "u_priya", role: "submitter" };
const jordan: Actor = { id: "u_jordan", role: "submitter" };
const marcus: Actor = { id: "u_marcus", role: "reviewer" };
const alana: Actor = { id: "u_alana", role: "reviewer" };
const dana: Actor = { id: "u_dana", role: "compliance_lead" };

const submission = (overrides: Partial<SubmissionScope> = {}): SubmissionScope => ({
  submitterId: priya.id,
  assigneeId: null,
  status: "submitted",
  ...overrides,
});

describe("role-only permissions", () => {
  it("lets every role create submissions", () => {
    for (const actor of [priya, marcus, dana]) {
      expect(can(actor, "submission.create")).toBe(true);
    }
  });

  it("keeps the overview, full queue, audit trail and rule test cases away from submitters", () => {
    for (const action of ["dashboard.view", "queue.view_all", "audit.view", "rules.test"] as const) {
      expect(can(priya, action)).toBe(false);
      expect(can(marcus, action)).toBe(true);
      expect(can(dana, action)).toBe(true);
    }
  });

  it("restricts audit export to the Compliance Lead", () => {
    expect(can(marcus, "audit.export")).toBe(false);
    expect(can(dana, "audit.export")).toBe(true);
  });
});

describe("viewing and commenting", () => {
  it("lets submitters see only their own submissions", () => {
    expect(can(priya, "submission.view", submission())).toBe(true);
    expect(can(jordan, "submission.view", submission())).toBe(false);
    expect(can(marcus, "submission.view", submission())).toBe(true);
  });

  it("closes comments once a submission is decided", () => {
    expect(can(priya, "submission.comment", submission({ status: "in_review" }))).toBe(true);
    const result = authorize(priya, "submission.comment", submission({ status: "approved" }));
    expect(result).toEqual({ allowed: false, reason: "This submission is closed." });
  });

  it("fails closed when a submission-scoped action gets no submission", () => {
    expect(can(dana, "submission.decide")).toBe(false);
  });
});

describe("separation of duties", () => {
  const ownedByMarcus = submission({ submitterId: marcus.id, status: "in_review", assigneeId: marcus.id });
  const ownedByDana = submission({ submitterId: dana.id, status: "in_review", assigneeId: alana.id });

  it("never lets a reviewer decide their own submission, even when assigned", () => {
    const result = authorize(marcus, "submission.decide", ownedByMarcus);
    expect(result.allowed).toBe(false);
    expect(!result.allowed && result.reason).toMatch(/Separation of duties/);
  });

  it("applies to the Compliance Lead too", () => {
    expect(can(dana, "submission.decide", ownedByDana)).toBe(false);
    expect(can(dana, "submission.claim", { ...ownedByDana, status: "submitted" })).toBe(false);
  });

  it("excludes the author from the assignee list", () => {
    expect(isEligibleAssignee(dana, ownedByDana)).toBe(false);
    expect(isEligibleAssignee(alana, ownedByDana)).toBe(true);
    expect(isEligibleAssignee(jordan, ownedByDana)).toBe(false);
  });
});

describe("claiming and deciding", () => {
  it("lets a reviewer pick up an unassigned submission", () => {
    expect(can(marcus, "submission.claim", submission())).toBe(true);
  });

  it("stops a reviewer from taking someone else's assignment, but not the lead", () => {
    const assigned = submission({ assigneeId: alana.id });
    expect(can(marcus, "submission.claim", assigned)).toBe(false);
    expect(can(dana, "submission.claim", assigned)).toBe(true);
  });

  it("requires the review to be started before deciding", () => {
    const result = authorize(marcus, "submission.decide", submission({ assigneeId: marcus.id }));
    expect(result).toEqual({
      allowed: false,
      reason: "Start the review before recording a decision.",
    });
  });

  it("lets only the assignee or the lead decide", () => {
    const inReview = submission({ status: "in_review", assigneeId: alana.id });
    expect(can(alana, "submission.decide", inReview)).toBe(true);
    expect(can(marcus, "submission.decide", inReview)).toBe(false);
    expect(can(dana, "submission.decide", inReview)).toBe(true);
    expect(can(priya, "submission.decide", inReview)).toBe(false);
  });

  it("limits assignment to the lead on open submissions", () => {
    expect(can(dana, "submission.assign", submission())).toBe(true);
    expect(can(marcus, "submission.assign", submission())).toBe(false);
    expect(can(dana, "submission.assign", submission({ status: "approved" }))).toBe(false);
  });
});

describe("resubmission", () => {
  it("is only for the original submitter after changes are requested", () => {
    const sentBack = submission({ status: "changes_requested" });
    expect(can(priya, "submission.resubmit", sentBack)).toBe(true);
    expect(can(jordan, "submission.resubmit", sentBack)).toBe(false);
    expect(can(dana, "submission.resubmit", sentBack)).toBe(false);
    expect(can(priya, "submission.resubmit", submission({ status: "rejected" }))).toBe(false);
  });
});

describe("assertCan", () => {
  it("throws a ForbiddenError carrying the reason", () => {
    expect(() => assertCan(priya, "audit.export")).toThrow(ForbiddenError);
    expect(() => assertCan(priya, "audit.export")).toThrow(
      "Only a Compliance Lead can export the audit trail.",
    );
  });
});
