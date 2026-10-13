import { describe, expect, it } from "vitest";
import { DEMO_USERS } from "../../../scripts/seed-data";
import {
  cleanEmailBody,
  draftFromEmail,
  guessChannel,
  guessLaunchDate,
  guessProduct,
  matchSender,
  parsePastedEmail,
  parseSentLine,
  titleFromSubject,
} from "./email";

const PEOPLE = DEMO_USERS.map(({ id, name, email, role }) => ({ id, name, email, role }));
const TODAY = "2026-10-13";

const COPY = `Subject: Consolidate your debt this fall

One fixed monthly payment, rates from 8.99% APR with autopay. Subject to credit approval.`;

const OUTLOOK = `From: Priya Raman <priya.raman@clearpath.example>
Sent: Tuesday, October 13, 2026 9:12 AM
To: Marketing Compliance <compliance@clearpath.example>
Subject: For review: Fall debt consolidation email

Hi Marcus,

Can you review the email below? We're launching 10/20.

${COPY}

Thanks!
Priya

Sent from my iPhone`;

describe("parsePastedEmail", () => {
  it("reads the header block Outlook puts on a copied message", () => {
    const email = parsePastedEmail(OUTLOOK);
    expect(email.from).toBe("Priya Raman <priya.raman@clearpath.example>");
    expect(email.receivedAt).toBe("2026-10-13T09:12");
    expect(email.subject).toBe("For review: Fall debt consolidation email");
    expect(email.body.startsWith("Hi Marcus,")).toBe(true);
  });

  it("tolerates blank lines between header lines and a forward marker on top", () => {
    const email = parsePastedEmail(`---------- Forwarded message ---------\nFrom: Jordan Ellis <jordan.ellis@clearpath.example>\n\nDate: Tue, Oct 13, 2026 at 4:40 PM\n\nSubject: Cash+ launch\nTo: compliance\n\nBody text`);
    expect(email.from).toContain("Jordan Ellis");
    expect(email.receivedAt).toBe("2026-10-13T16:40");
    expect(email.body).toBe("Body text");
  });

  it("leaves copy alone when it only looks like it has headers", () => {
    const email = parsePastedEmail(COPY);
    expect(email.from).toBe("");
    expect(email.subject).toBe("");
    expect(email.body).toBe(COPY);
  });
});

describe("parseSentLine", () => {
  it("reads the ways mail apps write a send time", () => {
    expect(parseSentLine("Tuesday, October 13, 2026 9:12 AM")).toBe("2026-10-13T09:12");
    expect(parseSentLine("Tue, Oct 13, 2026 at 4:40 PM (2 days ago)")).toBe("2026-10-13T16:40");
    expect(parseSentLine("10/13/2026")).toBe("2026-10-13T12:00");
  });

  it("converts times with an explicit offset into company time", () => {
    expect(parseSentLine("Tue, 13 Oct 2026 13:12:00 +0000")).toBe("2026-10-13T09:12");
  });

  it("returns null for anything else", () => {
    expect(parseSentLine("yesterday")).toBeNull();
    expect(parseSentLine("")).toBeNull();
  });
});

describe("cleanEmailBody", () => {
  it("keeps only the copy and says what it took out", () => {
    const { body, removed } = cleanEmailBody(parsePastedEmail(OUTLOOK).body, "Priya Raman");
    expect(body).toBe(COPY);
    expect(removed.map((r) => r.label)).toEqual(["Note to compliance", "Sign-off", "“Sent from” line"]);
  });

  it("drops earlier replies, signatures and confidentiality footers", () => {
    const { body, removed } = cleanEmailBody(
      `${COPY}\n\n-- \nPriya Raman | Growth Marketing\n\nOn Mon, Oct 12, 2026 at 3:00 PM Marcus Bell <marcus.bell@clearpath.example> wrote:\n> Send it over when ready.`,
    );
    expect(body).toBe(COPY);
    expect(removed.map((r) => r.label)).toEqual(["Signature", "Earlier messages in the thread"]);

    const footer = cleanEmailBody(`${COPY}\n\nCONFIDENTIALITY NOTICE: This message is intended only for the named recipient.`);
    expect(footer.body).toBe(COPY);
    expect(footer.removed[0].label).toBe("Confidentiality notice");
  });

  it("cuts at an Outlook reply block", () => {
    const { body } = cleanEmailBody(`${COPY}\n\n________________________________\nFrom: Marcus Bell\nSent: Monday, October 12, 2026 3:00 PM\nSubject: RE: copy`);
    expect(body).toBe(COPY);
  });

  it("finds the copy inside a forward when the note on top is just 'see below'", () => {
    const forwarded = `FYI, see below.\n\n---------- Forwarded message ---------\nFrom: Sofia Marquez <sofia.marquez@clearpath.example>\nDate: Tue, Oct 13, 2026 at 8:00 AM\nSubject: Prequal page\nTo: Agency\n\n${COPY}`;
    const { body, removed } = cleanEmailBody(forwarded);
    expect(body).toBe(COPY);
    expect(removed[0]).toEqual({ label: "Note above the forwarded email", text: "FYI, see below." });
  });

  it("reads quoted replies when the copy is in the quote", () => {
    const quoted = `Ok\n\nOn Tue, Oct 13, 2026 at 8:00 AM Sofia Marquez <sofia.marquez@clearpath.example> wrote:\n> ${COPY.split("\n").join("\n> ")}`;
    expect(cleanEmailBody(quoted).body).toBe(COPY);
  });
});

describe("draftFromEmail", () => {
  it("builds a draft a reviewer only needs to confirm", () => {
    const draft = draftFromEmail(parsePastedEmail(OUTLOOK), PEOPLE, TODAY);
    expect(draft).toMatchObject({
      title: "Fall debt consolidation email",
      productLine: "personal_loan",
      channel: "email",
      targetLaunchDate: "2026-10-20",
      body: COPY,
      senderId: "u_priya",
      senderNote: null,
      receivedAt: "2026-10-13T09:12",
    });
    expect(draft.fullBody).toContain("Hi Marcus,");
  });

  it("won't make a compliance reviewer the submitter", () => {
    const draft = draftFromEmail(parsePastedEmail(OUTLOOK.replace("Priya Raman <priya.raman", "Marcus Bell <marcus.bell")), PEOPLE, TODAY);
    expect(draft.senderId).toBeNull();
    expect(draft.senderNote).toContain("Marcus Bell");
  });

  it("keeps the whole body when cleanup would leave too little", () => {
    const draft = draftFromEmail({ from: "", receivedAt: null, subject: "", body: "Hi team,\n\nThanks!", messageId: "" }, PEOPLE, TODAY);
    expect(draft.body).toBe("Hi team,\n\nThanks!");
    expect(draft.removed).toEqual([]);
  });
});

describe("guesses", () => {
  it("strips reply and request prefixes from the subject", () => {
    expect(titleFromSubject("RE: FW: [Marketing] For review: Cash+ launch email")).toBe("Cash+ launch email");
    expect(titleFromSubject("Fwd: Review request – Holiday Instagram post")).toBe("Holiday Instagram post");
    expect(titleFromSubject("Re:")).toBe("");
  });

  it("guesses the product, checking the subject first", () => {
    expect(guessProduct("Prequal landing page", "loan")).toBe("mortgage_prequal");
    expect(guessProduct("Cash+ card launch", "")).toBe("credit_card");
    expect(guessProduct("", "consolidate your debt with a personal loan")).toBe("personal_loan");
    expect(guessProduct("Hello", "Nothing here")).toBeNull();
  });

  it("guesses the channel, with email as the last resort", () => {
    expect(guessChannel("Holiday Instagram post", "the email below")).toBe("social");
    expect(guessChannel("New landing page", "")).toBe("landing_page");
    expect(guessChannel("Balance transfer 300x250", "")).toBe("display_ad");
    expect(guessChannel("Spring postcard", "")).toBe("direct_mail");
    expect(guessChannel("Copy check", "subject line and body below")).toBe("email");
  });

  it("finds a launch date near launch words and rolls year-less dates forward", () => {
    expect(guessLaunchDate("We're launching 10/20.", TODAY)).toBe("2026-10-20");
    expect(guessLaunchDate("Goes live Oct 20th", TODAY)).toBe("2026-10-20");
    expect(guessLaunchDate("in-home Jan 4", TODAY)).toBe("2027-01-04");
    expect(guessLaunchDate("launch date 2026-09-01", TODAY)).toBeNull();
    expect(guessLaunchDate("Rates from 10/20 of last year", TODAY)).toBeNull();
  });

  it("matches senders by email, name, or 'Last, First'", () => {
    expect(matchSender("priya.raman@clearpath.example", PEOPLE)?.id).toBe("u_priya");
    expect(matchSender("\"Raman, Priya\" <p.r@agency.example>", PEOPLE)?.id).toBe("u_priya");
    expect(matchSender("Jordan Ellis <jordan@gmail.example>", PEOPLE)?.id).toBe("u_jordan");
    expect(matchSender("Someone Else <x@y.example>", PEOPLE)).toBeNull();
  });
});
