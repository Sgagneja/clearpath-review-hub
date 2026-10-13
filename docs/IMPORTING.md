# Bringing in your old tracker and emails

Review Hub can take over the reviews you're tracking in Excel today, and the
review requests sitting in your inbox, so nothing is left behind in the old
process. This guide is for the compliance team. The same guidance is on the
**Import** page in the app.

Only the compliance team (reviewers and the Compliance Lead) can import,
because an import records who submitted and who decided on other people's
behalf. Marketing sends new work through **New submission**.

## Before you start

- Everyone named in your tracker or emails needs to be on the team in Review
  Hub. Imports never create new people.
- Nothing is saved until you've seen a preview and confirmed it.
- The same review is never imported twice, so it's safe to try again after
  fixing a file.

---

## Excel or CSV tracker

### 1. Put your reviews in our template

Download the template from **Import › Excel tracker › Download the template**.
To see what a finished one looks like, choose **See a filled-in example**: it
has eight reviews and imports cleanly, so you can try the whole process first.

Copy your rows into the **Reviews** tab, one review per row. Keep the column
names on row 1 exactly as they are. The template has dropdowns for product,
channel and status, so the allowed values are always one click away.

| Column | Required? | What to enter | Example |
| --- | --- | --- | --- |
| Tracker ID | Optional | The ID from your old tracker, if it had one. It's kept on the imported review so you can match the two up | Q3-041 |
| Asset name | Required | A short name for the piece of marketing (4–120 characters) | Fall debt consolidation email |
| Product | Required | Personal loan, Credit card or Mortgage prequal | Personal loan |
| Channel | Required | Email, Landing page, Social post, Direct mail or Display ad | Email |
| Launch date | Required | The day it goes out to customers | 10/20/2026 |
| Submitted by | Required | Name or work email of the person who asked for the review. They must be on the team in Review Hub | Priya Raman |
| Submitted on | Required | When the review was requested. Add a time if you have it. Review deadlines are counted from here | 10/6/2026 9:30 AM |
| Copy | Required | Everything the customer reads (subject line, body and fine print) in one cell | Subject: Consolidate your debt… |
| Status | Required | Awaiting review, In review, Changes requested, Approved or Rejected | Approved |
| Reviewer | Required unless Awaiting review | Name or work email of the compliance reviewer. It can't be the person who submitted it | Marcus Bell |
| Decision date | Required for Changes requested, Approved and Rejected | When the reviewer decided. Leave blank while a review is still open | 10/8/2026 3:15 PM |
| Reviewer notes | Required for Changes requested and Rejected | What the reviewer said and why (at least 15 characters) | Add the APR range and the credit-approval caveat. |

Dates are month/day/year, in Eastern time. A date without a time is read as
midday.

### 2. Check what we can read

| We can read | We can't read |
| --- | --- |
| Excel workbooks (.xlsx) and CSV files | Older Excel files (.xls) and workbooks with macros (.xlsm) |
| The tab named "Reviews", or the first tab if there isn't one | Password-protected workbooks |
| Column names on row 1, spelled as in the template | Google Sheets or Numbers files, until they're downloaded as .xlsx |
| One review per row, up to 500 per file | Copy that only exists in a screenshot or an attachment |
| Files up to 2 MB | |

If you have more than 500 reviews, split them into several files and import
them one after another.

### 3. Upload it and check the results

Drop your file onto the page, or **choose a file**. Review Hub checks every
row straight away, before anything is saved:

- **If everything passes**, you'll see a preview: how many reviews of each
  status, which ones will join the queue, and today's pre-check result for each
  piece of copy. Choose **Import** to save them.
- **If anything needs fixing**, you'll see each problem with its row, its
  column and what to change. For example, in the Launch date column:
  "“13/10/2026” isn't a date we can read. Use month/day/year, like 10/13/2026."
  Nothing is imported until every row passes, so fix the file and choose
  **Upload the fixed file**.
- **If a review is already in Review Hub**, the row is listed with its review
  number (for example, "Already in Review Hub as MKT-1031") so you can remove it.

### What happens to each review

| Status in your tracker | What it becomes |
| --- | --- |
| Awaiting review, In review | Joins the queue with its real deadline, counted from "Submitted on". Overdue work shows as overdue |
| Changes requested | Goes back to the submitter, who can revise and resubmit it in Review Hub |
| Approved, Rejected | Becomes history: it counts toward the dashboard and appears in the audit trail |

Every imported review shows where it came from (for example, "Q3
tracker.xlsx · row 12") and the audit trail records who imported it and when.

---

## Review request emails

For requests that only exist in someone's inbox. Go to **Import › Email**.

### Paste it, or upload the saved email

- **Paste the email:** open it, select everything, copy and paste it in,
  including the From, Sent and Subject lines at the top. That's how Review Hub
  knows who asked and when.
- **Upload a saved email:** save the email as a file, then drop it onto the
  page or choose it. How to save one:

| Email app | How to save the email |
| --- | --- |
| Outlook on the web, or new Outlook | Open the email, choose ⋯ › Save as, or Download |
| Outlook for Mac | Drag the email from your inbox onto the desktop |
| Outlook for Windows (classic) | It only saves .msg files, which we can't read. Copy and paste instead |
| Gmail | Open the email, choose ⋮ › Download message |
| Apple Mail | Choose File › Save As, then Raw Message Source |

Choose **Try an example email** to see how it works first.

### Check what we found

Choose **Pull out the copy**. Review Hub separates the request from the copy,
setting aside greetings, signatures and earlier replies, and suggests the
product, channel and launch date from what the email says. You confirm or
correct every field before anything is saved:

- **Who sent it**, matched to someone on the marketing team. Requests can only
  come from marketing, not from compliance.
- **When it arrived.** The review deadline counts from this moment, not from
  today.
- **The copy, asset name, product, channel and launch date.**

The email is read on your own computer. Only the fields you confirm are sent
to Review Hub, never the email itself or its attachments.

### Limits

- One email per import, with the copy in the message itself. Copy that only
  exists in an attachment or a screenshot needs to be pasted as a new
  submission.
- Saved email files up to 10 MB.
- An email that's already been imported is recognised and won't be brought in
  twice.
