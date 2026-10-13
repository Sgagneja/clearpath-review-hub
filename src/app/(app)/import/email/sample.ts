/**
 * A realistic review request, as it would look copied out of Outlook: a
 * greeting, the copy, a sign-off, a signature and the earlier reply below.
 * Dated relative to today so it always imports cleanly in the demo.
 */
export function sampleEmail(today: string): string {
  const day = (offset: number) => new Date(Date.parse(`${today}T12:00:00Z`) + offset * 86_400_000);
  const long = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const launch = day(12);

  return `From: Sofia Marquez <sofia.marquez@clearpath.example>
Sent: ${long(day(-1))} 8:47 AM
To: Marketing Compliance <compliance@clearpath.example>
Subject: RE: For review: First-home prequal landing page

Hi team,

Can you take a look at the landing page copy below? We'd like it to go live ${launch.getUTCMonth() + 1}/${launch.getUTCDate()}.

Your first home is closer than you think

Get pre-approved in minutes with ClearPath Home Lending. Checking your rate won't affect your credit score, and first-time buyers can put as little as 3% down.

Start your prequalification today.

Thanks so much,
Sofia

--
Sofia Marquez | Home Lending Marketing
ClearPath Financial

From: Alana Torres <alana.torres@clearpath.example>
Sent: ${long(day(-2))} 4:05 PM
To: Sofia Marquez <sofia.marquez@clearpath.example>
Subject: RE: Prequal page

Send the final copy over when it's ready and we'll pick it up.`;
}
