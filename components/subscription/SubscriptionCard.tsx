import Link from "next/link";
import { useMemo } from "react";
import { memo } from "react";
import { Subscription } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useLedger } from "@/lib/ledger";
import { usePlan } from "@/lib/hooks/usePlan";
import CancelButton from "./CancelButton";
import PauseButton from "./PauseButton";

type Props = {
  subscription: Subscription;
  currentLedger?: number;
};

/**
 * Buckets the remaining ledgers so that the comparator only treats a ledger
 * tick as a change when the displayed countdown text would actually change.
 */
function countdownBucket(
  nextChargeLedger: number | undefined,
  currentLedger: number | undefined,
): number {
  if (nextChargeLedger === undefined || currentLedger === undefined) {
    return 0;
  }
  return Math.max(0, nextChargeLedger - currentLedger);
}

export function arePropsEqual(prev: Props, next: Props): boolean {
  const a = prev.subscription;
  const b = next.subscription;

  if (
    a.id !== b.id ||
    a.planName !== b.planName ||
    a.merchantName !== b.merchantName ||
    a.amount !== b.amount ||
    a.currency !== b.currency ||
    a.interval !== b.interval ||
    a.nextChargeAt !== b.nextChargeAt ||
    a.status !== b.status
  ) {
    return false;
  }

  return (
    countdownBucket(a.nextChargeLedger, prev.currentLedger) ===
    countdownBucket(b.nextChargeLedger, next.currentLedger)
  );
}

function SubscriptionCard({ subscription }: Props) {
  const {
    id,
    planId,
    planName,
    merchantName,
    amount,
    currency,
    interval,
    nextChargeAt,
    startLedger,
    status,
    address,
    network,
  } = subscription;

  const { currentLedger } = useLedger();
  const { data: plan, isLoading, error } = usePlan(
    planId !== 0 ? planId : null,
  );

  const isActive = status === "active";
  const isPaused = status === "paused";
  const isFutureStart = currentLedger < startLedger;
  const startsIn = formatApproxDuration(startLedger - currentLedger);

  const sortedSubscription = useMemo(
    () => sortForDisplay([subscription]),
    [subscription, address, network],
  );

  return (
    <article
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm focus-within:ring-2 focus-within:ring-blue-600"
      aria-labelledby={`subscription-${id}-title`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3
            id={`subscription-${id}-title`}
            className="text-base font-semibold text-gray-900"
          >
            <Link
              href={`/plans/${id}`}
              className="rounded underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              {planName}
            </Link>
          </h3>
          <p className="text-sm text-gray-600">{merchantName}</p>
          {planId !== 0 && (
            <p className="text-xs text-gray-500">
              {isLoading
                ? "Loading plan…"
                : error
                  ? "Plan unavailable"
                  : plan?.name}
            </p>
          )}
        </div>
        <span
          className={
            isActive
              ? "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800"
              : isPaused
                ? "rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800"
                : "rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
          }
        >
          {status}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-gray-500">Amount</dt>
          <dd className="font-medium text-gray-900">
            {formatCurrency(amount, currency)} / {interval}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Next charge</dt>
          <dd className="font-medium text-gray-900">
            {isFutureStart
              ? `Starts in ~${startsIn}`
              : isActive
                ? formatDate(nextChargeAt)
                : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/plans/${id}`}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          View plan
        </Link>
        {isActive && <PauseButton subscriptionId={id} />}
        {(isActive || isPaused) && <CancelButton subscriptionId={id} />}
      </div>
    </article>
  );
}

const MemoizedSubscriptionCard = memo(SubscriptionCard, arePropsEqual);

export { MemoizedSubscriptionCard as SubscriptionCard };
export default MemoizedSubscriptionCard;
