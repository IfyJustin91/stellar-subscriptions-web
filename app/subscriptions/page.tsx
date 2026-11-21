"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { sortForDisplay } from "@/lib/subscription";
import { scoreHealth, type HealthLevel } from "@/lib/subscription-health";
import { CommittedSpend } from "@/components/subscription/CommittedSpend";
import { SubscriptionCard } from "@/components/subscription/SubscriptionCard";
import { AllowanceBanner } from "@/components/subscription/AllowanceBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingBlock } from "@/components/ui/Spinner";
import { RequireWallet } from "@/components/wallet/RequireWallet";
import { SubStatus } from "@/types";

const BASE_TITLE = "My Subscriptions";

/** Browser-tab title: the active count once loaded, the bare title otherwise. */
function subscriptionsTitle(activeCount: number | undefined): string {
  return activeCount === undefined ? BASE_TITLE : `${BASE_TITLE} (${activeCount})`;
}

export default function MySubscriptionsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-fg">My subscriptions</h1>
        <p className="max-w-2xl text-sm text-muted">
          Everything you&apos;ve authorized. Pause or cancel any of it here — a cancelled subscription can never be
          charged again.
        </p>
      </header>

      <RequireWallet purpose="see your subscriptions">{(address) => <Subscriptions address={address} />}</RequireWallet>
    </div>
  );
}

function Subscriptions({ address }: { address: string }) {
  const subs = useSubscriptions(address);
  const activeCount = subs.data?.filter((sub) => sub.status === SubStatus.Active).length;

  useEffect(() => {
    document.title = subscriptionsTitle(activeCount);
  }, [activeCount]);

  // Don't leave a stale count behind when the list unmounts (e.g. wallet disconnects).
  useEffect(
    () => () => {
      document.title = BASE_TITLE;
    },
    [],
  );

  if (subs.error) {
    return <ErrorState error={subs.error} title="Couldn't load your subscriptions" onRetry={subs.reload} />;
  }
  if (!subs.data) return <LoadingBlock label="Loading your subscriptions" />;

  if (subs.data.length === 0) {
    return (
      <EmptyState
        title="No subscriptions yet"
        description="When you subscribe to a plan, it shows up here with your cap, what's been charged, and controls to pause or cancel."
        action={
          <Link href="/plans" className="btn-primary">
            Browse plans
          </Link>
        }
      />
    );
  }

  const ordered = sortForDisplay(subs.data);
  const health = scoreHealth(subs.data, subs.balances, subs.allowances);
  return (
    <div className="space-y-6">
      <HealthBadge health={health} />
      <AllowanceBanner subs={subs.data} />
      <CommittedSpend subs={subs.data} />
      <ul className="grid gap-4 lg:grid-cols-2">
        {ordered.map((sub) => (
          <li key={sub.id}>
            <Link href={`/subscriptions/${sub.id}`} className="block">
              <SubscriptionCard sub={sub} onChanged={subs.reload} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const HEALTH_STYLES: Record<HealthLevel, { label: string; className: string }> = {
  good: { label: "Good", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  "at-risk": { label: "At Risk", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  critical: { label: "Critical", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

function HealthBadge({ health }: { health: HealthLevel }) {
  const { label, className } = HEALTH_STYLES[health];
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted">Subscription health</span>
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
        {label}
      </span>
    </div>
  );
}
