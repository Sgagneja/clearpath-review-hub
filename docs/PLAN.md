# Plan

What we're building, for whom, and how we'll know it worked. The reasoning
behind individual choices is in [DECISIONS.md](DECISIONS.md).

## The problem

ClearPath's marketing team writes ads, emails, landing pages, social posts and
direct mail for personal loans, credit cards and mortgage pre-qualification.
Before anything reaches a customer, the marketing compliance team reviews it
against lending and advertising rules (Truth in Lending, fair lending, unfair or
deceptive practices, and so on).

Today that review runs on a shared Excel tracker and email:

- Marketing emails copy to the compliance inbox, or to whoever they know.
- Someone logs it in the tracker, if they remember.
- A reviewer reads it, replies with comments, and the marketer replies with a
  new draft. The versions live in the reply chain.
- When an examiner asks how something was approved, someone rebuilds the story
  from the tracker and old emails.

**The review process is now the bottleneck on growth.** Marketing can produce
more campaigns than compliance can clear, and the delay isn't the judgement
calls. It's the coordination around them: finding out what's waiting, who owns
it, which version is current, whether it's late, and re-explaining the same
mistakes on every draft.

**The goal: increase the throughput of the compliance marketing team** (more
reviews decided, sooner, with fewer rounds) without lowering the bar.

## Who uses it

The people using Review Hub are compliance and marketing professionals, not
technical staff. Every screen is written in their language and works without
setup or training.

| Role | Who | What they need |
| --- | --- | --- |
| Submitter | Marketing managers | Send copy, know where it stands, know exactly what to fix, and know early if a launch is at risk |
| Reviewer | Compliance analysts | Know what to work on next, start from a marked-up draft instead of a blank read, and record a decision once |
| Compliance Lead | Director of marketing compliance | See where work is stuck, balance workload, and hand an examiner a complete record |

## How Review Hub raises throughput

Each feature exists to remove one kind of coordination work:

1. **One queue, ordered by deadline.** Every open review is in one place,
   soonest deadline first, with overdue, due-soon, launch-at-risk and unassigned
   counts at the top. Nothing waits in an inbox nobody owns.
2. **Deadlines set by risk.** High-risk copy is due in 48 hours, medium in 72
   and low in 120. Deadlines pause while a review is back with marketing, and
   the queue warns when a deadline falls on or after launch day, so a slipping
   launch shows up days early instead of on the day.
3. **A pre-check before anyone reads it.** Sixteen written rules flag the
   recurring problems (an interest rate quoted without the APR, "guaranteed
   approval", a mortgage ad with no NMLS ID) and mark them in the copy with the
   rule behind each and a suggested fix. Reviewers start from a marked-up
   draft. Marketing sees the same check live while writing, so many problems
   never reach compliance at all.
4. **Versions and tracked changes.** Each revision is kept and the review shows
   exactly which words changed, so a re-review takes minutes rather than a
   full re-read. Findings a revision fixed are shown as fixed.
5. **Decisions recorded once.** Approve, request changes or reject, with the
   reasoning attached. The submitter sees it immediately; the audit trail
   records it permanently.
6. **Bring the history across.** The team's existing Excel tracker and review
   emails can be imported, so the switch doesn't start from an empty system or
   leave open work behind in the old one. See [IMPORTING.md](IMPORTING.md).
7. **See where the time goes.** The team overview, the first screen for
   compliance, shows how much work sits at each stage and which stage is
   slowest, who has what and how close it is to its deadline, turnaround,
   on-time rate, first-time approvals, weekly volume and which guidelines
   marketing trips over most. That last one is the training list that cuts
   future rounds.

## How we measure success

These are on the team overview, computed from the same records the team works in
(the definitions are unit-tested in `src/domain/metrics.ts`):

| Measure | Definition | Direction |
| --- | --- | --- |
| Typical turnaround | Median time from first submission to final decision, including revisions | Down |
| Decided on time | Share of review rounds decided before their deadline | Up |
| Approved first time | Share of submissions approved on their first round | Up |
| Weekly throughput | Decisions and new submissions per week | Decisions keep pace with submissions |
| Time in each stage | Average time awaiting pickup, in review and with the submitter | The longest stage is called out as the bottleneck |
| Reviewer workload | Open reviews and decisions per reviewer, with typical time from starting a review to deciding it | Balanced |
| Most common findings | Which rules fire most on first drafts | Fewer over time |

## Principles

- **Throughput first.** Every screen should answer "what should I do next?"
  A feature that doesn't save the team time doesn't ship.
- **Plain language.** No technical terms on screen: "review deadline" rather
  than "SLA", "Version 2" rather than "v2". Error messages say what happened and
  what to do, never how the system works inside.
- **Works out of the box.** No settings page, no configuration for the team to
  maintain. Sensible defaults are built in.
- **Strict where it protects the record, forgiving everywhere else.** Imports
  accept one documented layout and save nothing until every row passes. The
  audit trail can't be edited. Everything else explains and recovers.
- **Authorization on the server.** Hiding a button is a courtesy; the server
  checks every read and write.
- **Usable by everyone, on anything.** Keyboard and screen-reader accessible,
  and every page fits a phone, tablet, laptop or large monitor.

## Scope

### In this version

- Sign in as one of seven sample employees (demo sign-in; see
  [SECURITY.md](../SECURITY.md))
- Submit copy with a live pre-check; review queue with filters, search and sorting
- Review page: marked-up copy, findings, version history, tracked changes,
  comments, timeline, deadline
- Start review, assign or reassign (Compliance Lead), approve, request changes,
  reject; revise and resubmit
- Separation of duties: nobody can review their own copy
- Permanent audit trail with filters and an Excel-ready download (Compliance Lead)
- Excel/CSV tracker import and email import, each previewed before saving
- Dashboard of throughput measures
- Rule library: every pre-check rule, what it looks for and why

### Deliberately not in this version

| Not included | Why not yet |
| --- | --- |
| Real company sign-in (SSO) | A demo has no company directory to connect to. The permission model is already independent of how people sign in, so SSO slots in without changes to it |
| Notifications (email, Slack, Teams) | Needs the company's messaging accounts. The queue and badges cover "what's waiting" for now |
| Images, PDFs and video review | Copy is where most findings are. Creative review needs file storage and an annotation tool |
| A forwarding address that turns emails into reviews automatically | Needs a mail provider and domain. Importing an email by hand shows the flow first |
| Business-hours and holiday-aware deadlines | Calendar hours are simpler to explain and audit. A team calendar is a later refinement |
| Editing rules or deadlines in the app | Rules carry legal citations and need review before they change. Keeping them in code means every change is versioned and tested |
| Multiple companies or teams in one deployment | ClearPath is one compliance team |

## Delivery

| Stage | Status |
| --- | --- |
| Data model, migrations, permanent audit trail | Done |
| Workflow, permissions, deadlines, risk scoring, pre-check (16 rules) | Done |
| Queue, review page, submit and revise, decisions, comments | Done |
| Dashboard, audit trail and download, rule library | Done |
| Excel/CSV and email import with guidelines | Done |
| Fits every screen size, checked automatically at five sizes | Done |
| Documentation | Done |
| Design pass away from the generic dashboard look | Done |
| Last plain-language pass on remaining technical terms | Done |
| Friendly error pages everywhere, clear message for missing configuration | Done |
| Automated checks on every change (GitHub Actions) | Done |
| Public deploy on Vercel and Neon, live link | Done |
| Team overview first (Team and My work tabs), with the review pipeline | Done |
| Per-product test cases for the pre-check, visible to compliance in the Rule library | Done |
| Full lifecycle on each submission, in the space of the old progress strip | Done |
| Every workflow tested end to end against every table | Done |
| Worked examples in the README, with the team overview's counts checked at every step | Done |

## After this version

In rough order of throughput impact:

1. Notifications when work arrives, is due soon or comes back.
2. A forwarding address for review requests, so emails become reviews without
   anyone importing them.
3. Company sign-in (SSO) and a production database role that can only add to
   the audit trail, never change it.
4. Image and PDF review with on-image comments.
5. Deadlines that respect business hours and company holidays.
6. Rule changes proposed and approved inside the app, with the same audit trail.

## Known limits at larger scale

Comfortable for one compliance team and a few years of history. These are the
first things to change as volume grows, roughly in the order they'd be hit:

| Limit | When it bites | Fix |
| --- | --- | --- |
| The audit download is built in memory and sent in one response | Around 18,000 events, Vercel's response size limit (about 4.5 MB) | Stream the file, or download by date range |
| The dashboard reads every submission and version, then does the maths in the app | Several thousand submissions | Move the totals into SQL, limited to the dashboard's date range |
| The queue shows at most 200 rows | More than 200 open reviews at once | Page through results |
| Rate limits are counted per server instance | Many instances under load, where a busy user could exceed the limit | Keep the counts in a shared store such as Redis |
