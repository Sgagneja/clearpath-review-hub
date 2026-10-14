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
 * Top of the overview. The whole team comes first; your own work is one tab
 * over, so nobody's view of the bottleneck stops at their own desk.
 */
export function OverviewHeader({ active, context, myCount }: { active: Tab; context: string; myCount: number }) {
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
