import { describe, expect, it } from "vitest";
import {
  approvalNeedsRationale,
  createSubmissionSchema,
  decisionSchema,
  fieldErrors,
  firstValues,
  queueFiltersSchema,
  referenceSchema,
  safeNextPath,
} from "./validation";

const today = new Date("2026-10-12T15:00:00Z");
const schema = createSubmissionSchema(today);
const valid = {
  title: "Fall debt consolidation email",
  productLine: "personal_loan",
  channel: "email",
  targetLaunchDate: "2026-10-30",
  body: "Consolidate your debt with a ClearPath personal loan. Terms apply.",
};

describe("createSubmissionSchema", () => {
  it("accepts a well-formed submission and trims text", () => {
    const parsed = schema.parse({ ...valid, title: "  Fall email  " });
    expect(parsed.title).toBe("Fall email");
  });

  it.each([
    ["productLine", "auto_loan"],
    ["channel", "billboard"],
    ["targetLaunchDate", "2026-10-11"],
    ["targetLaunchDate", "2026-02-30"],
    ["targetLaunchDate", "2027-12-01"],
    ["targetLaunchDate", "next tuesday"],
    ["body", "too short"],
    ["title", "x"],
  ])("rejects an invalid %s (%s)", (field, value) => {
    const result = schema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(fieldErrors(result.error))).toContain(field);
  });

  it("allows launching today", () => {
    expect(schema.safeParse({ ...valid, targetLaunchDate: "2026-10-12" }).success).toBe(true);
  });

  it("saves line breaks the way the writer's live pre-check saw them", () => {
    const parsed = schema.parse({ ...valid, body: "Consolidate your debt.\r\nOne payment, one rate.\r\n\r\nTerms apply.\r\n" });
    expect(parsed.body).toBe("Consolidate your debt.\nOne payment, one rate.\n\nTerms apply.");
  });

  it("caps the copy length", () => {
    expect(schema.safeParse({ ...valid, body: "a".repeat(8_001) }).success).toBe(false);
  });
});

describe("decisionSchema", () => {
  const base = { reference: "MKT-1042" };

  it("lets an approval go through without a comment", () => {
    expect(decisionSchema.safeParse({ ...base, decision: "approve" }).success).toBe(true);
  });

  it("requires an actionable comment to request changes or reject", () => {
    for (const decision of ["request_changes", "reject"]) {
      const result = decisionSchema.safeParse({ ...base, decision, comment: "fix it" });
      expect(result.success).toBe(false);
      if (!result.success) expect(fieldErrors(result.error).comment).toMatch(/Explain/);
    }
  });

  it("rejects unknown decisions", () => {
    expect(decisionSchema.safeParse({ ...base, decision: "escalate" }).success).toBe(false);
  });
});

describe("approvalNeedsRationale", () => {
  it("requires a rationale only to approve over open high findings", () => {
    expect(approvalNeedsRationale("approve", 1)).toBe(true);
    expect(approvalNeedsRationale("approve", 0)).toBe(false);
    expect(approvalNeedsRationale("reject", 3)).toBe(false);
  });
});

describe("referenceSchema", () => {
  it("only accepts MKT references", () => {
    expect(referenceSchema.safeParse("MKT-1042").success).toBe(true);
    expect(referenceSchema.safeParse("MKT-1042; DROP TABLE").success).toBe(false);
    expect(referenceSchema.safeParse("../../etc/passwd").success).toBe(false);
  });
});

describe("queueFiltersSchema", () => {
  it("defaults to open items sorted by SLA", () => {
    expect(queueFiltersSchema.parse({})).toEqual({
      status: "open",
      product: "all",
      risk: "all",
      assignee: "all",
      q: "",
      sort: "sla",
      dir: "asc",
    });
  });

  it("falls back to defaults for tampered values instead of erroring", () => {
    const parsed = queueFiltersSchema.parse(
      firstValues({ status: "<script>", sort: ["risk", "sla"], assignee: "' OR 1=1" }),
    );
    expect(parsed.status).toBe("open");
    expect(parsed.sort).toBe("risk");
    expect(parsed.assignee).toBe("all");
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths, including query strings", () => {
    expect(safeNextPath("/submissions/MKT-1018")).toBe("/submissions/MKT-1018");
    expect(safeNextPath("/queue?status=all&sort=risk")).toBe("/queue?status=all&sort=risk");
  });

  it("rejects anything that could leave the site", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "queue",
      "/queue#<script>",
    ]) {
      expect(safeNextPath(value), value).toBeNull();
    }
  });

  it("ignores loops back to the login page and non-strings", () => {
    expect(safeNextPath("/login?next=/queue")).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(["/queue"])).toBeNull();
  });
});
