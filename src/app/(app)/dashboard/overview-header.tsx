import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TabNav } from "@/components/ui/tab-nav";

type Tab = "team" | "mine";

const DESCRIPTIONS: Record<Tab, string> = {
  team: "Everything on the compliance team's desk right now, who has it, and how fast it's moving.",
  mine: "Your part of it: what's waiting on you, what nobody has picked up yet, and how your reviews have gone.",
};

/**
 * Top of the overview. For the Compliance Lead the whole team comes first and
 * their own work is one tab over. Reviewers only see their own work, so for
 * them it's a page of its own, without the tabs.
 */
export function OverviewHeader({
  active,
  context,
  myCount,
  showTeam = true,
}: {
  active: Tab;
  context: string;
  myCount: number;
  showTeam?: boolean;
}) {
  if (!showTeam) {
    return (
      <PageHeader
        context={context}
        title="My work"
        description="What's waiting on you, what nobody has picked up yet, and how your reviews have gone."
        actions={
          <Link href="/queue" className={buttonClasses({ variant: "secondary" })}>
            Open the queue
            <ArrowRight aria-hidden="true" />
          </Link>
        }
      />
    );
  }
  return (
    <div>
      <PageHeader
        context={context}
        title="Team overview"
        description={DESCRIPTIONS[active]}
        actions={
          <Link href="/queue" className={buttonClasses({ variant: "secondary" })}>
            Open the queue
            <ArrowRight aria-hidden="true" />
          </Link>
        }
      />
      <TabNav
        label="Overview"
        active={active}
        className="mt-5"
        items={[
          { key: "team", href: "/dashboard", label: "Team" },
          { key: "mine", href: "/dashboard/mine", label: "My work", count: myCount, countLabel: "waiting on you" },
        ]}
      />
    </div>
  );
}
