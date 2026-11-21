import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { SubscriptionCard } from './SubscriptionCard';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { SubscriptionCard } from './SubscriptionCard';
import * as sortModule from '@/lib/sortForDisplay';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { axe } from 'vitest-axe';
import SubscriptionCard from './SubscriptionCard';
import { SubStatus } from '@/lib/types';
import type { Subscription } from '@/lib/types';
import { usePlan } from '@/hooks/usePlans';

vi.mock('@/hooks/usePlans', () => ({
  usePlan: vi.fn(),
}));

const mockedUsePlan = vi.mocked(usePlan);

// Mock the ledger hook so tests can drive the current ledger number.
const ledgerState = vi.hoisted(() => ({ current: 1000 }));

vi.mock('@/lib/hooks/useLedger', () => ({
  useLedger: () => ledgerState.current,
}));

const base: Subscription = {
  id: 'sub_123',
  planId: 'plan_basic',
  planName: 'Basic',
  status: SubStatus.Active,
  token: 'XLM',
  cap: 120_000_000n,
  totalCharged: 30_000_000n,
  startLedger: 100,
  nextChargeLedger: 1_000,
};

const renderCard = (subscription: Subscription) =>
  render(<SubscriptionCard subscription={subscription} />);
const base: Subscription = {
  ...baseSubscription,
  status: SubStatus.Active,
  token: 'XLM',
  cap: 120_000_000n,
  totalCharged: 30_000_000n,
  nextChargeLedger: 1200,
};

function renderCard(subscription: Subscription) {
  return render(<SubscriptionCard subscription={subscription} />);
}

describe('SubscriptionCard', () => {
  beforeEach(() => {
    mockedUsePlan.mockReset();
    mockedUsePlan.mockReturnValue({ plan: null, isLoading: false, error: null } as ReturnType<
      typeof usePlan
    >);
    ledgerState.current = 1000;
  });

  it('renders the subscription details', () => {
    renderCard(base);

    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText(/Active/i)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderCard(base);

    expect(await axe(container)).toHaveNoViolations();
  });

  describe('plan name', () => {
    it('does not render a plan name and requests null when planId is 0', () => {
      const { queryByTestId } = render(
        <SubscriptionCard subscription={{ ...baseSubscription, planId: 0 }} />,
      );

      expect(mockedUsePlan).toHaveBeenCalledWith(null);
      expect(queryByTestId('plan-name')).not.toBeInTheDocument();
    });

    it('renders the plan name as a secondary label when planId is non-zero', () => {
      mockedUsePlan.mockReturnValue({
        plan: { id: 42, name: 'Pro Plan' },
        isLoading: false,
        error: null,
      } as ReturnType<typeof usePlan>);

      const { getByTestId } = render(
        <SubscriptionCard subscription={{ ...baseSubscription, planId: 42 }} />,
      );

      expect(mockedUsePlan).toHaveBeenCalledWith(42);
      expect(getByTestId('plan-name')).toHaveTextContent('Pro Plan');
    });

    it('shows a loading placeholder while the plan is loading', () => {
      mockedUsePlan.mockReturnValue({
        plan: null,
        isLoading: true,
        error: null,
      } as ReturnType<typeof usePlan>);

      const { getByTestId } = render(
        <SubscriptionCard subscription={{ ...baseSubscription, planId: 42 }} />,
      );

      expect(getByTestId('plan-name-loading')).toBeInTheDocument();
    });

    it('shows a graceful message when the plan fails to load', () => {
      mockedUsePlan.mockReturnValue({
        plan: null,
        isLoading: false,
        error: new Error('boom'),
      } as ReturnType<typeof usePlan>);

      const { getByTestId } = render(
        <SubscriptionCard subscription={{ ...baseSubscription, planId: 42 }} />,
      );

      expect(getByTestId('plan-name-error')).toHaveTextContent('Plan unavailable');
    });
  it('does not re-sort when re-rendered with the same subscriptions identity', () => {
    const sortSpy = vi.spyOn(sortModule, 'sortForDisplay');
    const subscriptions = [baseSubscription];

    const { rerender } = render(<SubscriptionCard subscriptions={subscriptions} />);
    expect(sortSpy).toHaveBeenCalledTimes(1);

    // Simulate an unrelated state change (e.g. a ledger tick) that re-renders
    // the parent with the same subscriptions array identity.
    rerender(<SubscriptionCard subscriptions={subscriptions} />);
    rerender(<SubscriptionCard subscriptions={subscriptions} />);

    expect(sortSpy).toHaveBeenCalledTimes(1);

    sortSpy.mockRestore();
  });

  describe("CapProgress", () => {
    it("shows 0% when nothing has been charged", () => {
      renderCard({ ...base, totalCharged: 0n });
      const bar = screen.getByRole("progressbar", { name: "0% of the cap charged" });
      expect(bar).toHaveAttribute("aria-valuenow", "0");
      expect(bar).toHaveAttribute("aria-valuemin", "0");
      expect(bar).toHaveAttribute("aria-valuemax", "100");
    });

    it("shows the partial percentage and matching aria-valuenow", () => {
      renderCard(base);
      const bar = screen.getByRole("progressbar", { name: "25% of the cap charged" });
      expect(bar).toHaveAttribute("aria-valuenow", "25");
      expect(bar).toHaveAttribute("aria-valuemin", "0");
      expect(bar).toHaveAttribute("aria-valuemax", "100");
    });

    it("shows 100% when the whole cap has been charged", () => {
      renderCard({ ...base, status: SubStatus.Exhausted, totalCharged: 120_000_000n });
      const bar = screen.getByRole("progressbar", { name: "100% of the cap charged" });
      expect(bar).toHaveAttribute("aria-valuenow", "100");
    });

    it("keeps the charged percentage visible once cancelled", () => {
      renderCard({ ...base, status: SubStatus.Cancelled });
      const bar = screen.getByRole("progressbar", { name: "25% of the cap charged" });
      expect(bar).toHaveAttribute("aria-valuenow", "25");
    });
  });

  describe("SubStatusBadge", () => {
    it.each([
      [SubStatus.Active, /Active/i],
      [SubStatus.Paused, /Paused/i],
      [SubStatus.Cancelled, /Cancelled/i],
      [SubStatus.Exhausted, /Exhausted/i],
    ])("renders a badge for %s", (status, label) => {
      renderCard({ ...base, status });
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  describe("CommittedSpend", () => {
    it("shows the remaining committed amount for a single token", () => {
      renderCard(base);
      // 120_000_000 - 30_000_000 = 90_000_000 stroops = 9 XLM
      expect(screen.getByText(/9(\.0+)?\s*XLM/)).toBeInTheDocument();
    });

    it("never adds different tokens together", () => {
      renderCard({ ...base, token: "CUSDC" });
      // Only the subscription's own token is shown; no XLM figure leaks in.
      expect(screen.queryByText(/XLM/)).not.toBeInTheDocument();
    });

    it("shows nothing committed when the cap is fully charged", () => {
      renderCard({ ...base, status: SubStatus.Exhausted, totalCharged: 120_000_000n });
      expect(screen.queryByText(/9(\.0+)?\s*XLM/)).not.toBeInTheDocument();
    });
  });

  describe("Future start", () => {
    it("shows a starts-in label instead of the charge countdown when startLedger is in the future", () => {
      // Mock the current ledger so it is below the subscription's startLedger.
      vi.spyOn(SubscriptionCard.prototype as never, 'constructor' as never).mockImplementation(
        () => undefined as never,
      );
      renderCard({ ...base, startLedger: 1_000_000, nextChargeLedger: 1_000_100 });

      expect(screen.getByText(/Starts in ~/)).toBeInTheDocument();
      expect(screen.queryByText(/Not before about/)).not.toBeInTheDocument();
      expect(screen.queryByText(/can be charged now/i)).not.toBeInTheDocument();
    });
  });

  describe("NextChargeCountdown", () => {
    it("reads as not-yet when the next charge is in the future", async () => {
      renderCard(base);
      expect(await screen.findByText(/Not before about/)).toBeInTheDocument();
    });

    it("reads as allowed-now when the next charge ledger has passed", async () => {
      renderCard({ ...base, nextChargeLedger: 900 });
      expect(await screen.findByText(/can be charged now/i)).toBeInTheDocument();
    });

    it("says none while paused", () => {
      renderCard({ ...base, status: SubStatus.Paused });
      expect(screen.getByText("None while paused")).toBeInTheDocument();
    });

    it("says none once cancelled", () => {
      renderCard({ ...base, status: SubStatus.Cancelled });
      expect(screen.getByText("None — cancelled")).toBeInTheDocument();
    });

    it("says none once the cap is fully charged", () => {
      renderCard({ ...base, status: SubStatus.Exhausted, totalCharged: 120_000_000n });
      expect(screen.getByText(/Nothing more can be taken/)).toBeInTheDocument();
    });
  });

  describe("re-render behaviour", () => {
    it("only re-renders the card whose countdown changes when the ledger advances", () => {
      const nearCard = { ...base, id: "sub_near", nextChargeLedger: 1001 };
      const farCard = { ...base, id: "sub_far", nextChargeLedger: 5000 };

      const nearRender = vi.fn();
      const farRender = vi.fn();

      function TrackedCard({
        subscription,
        onRender,
      }: {
        subscription: Subscription;
        onRender: () => void;
      }) {
        onRender();
        return <SubscriptionCard subscription={subscription} />;
      }

      const { rerender } = render(
        <>
          <TrackedCard subscription={nearCard} onRender={nearRender} />
          <TrackedCard subscription={farCard} onRender={farRender} />
        </>,
      );

      const nearInitial = nearRender.mock.calls.length;
      const farInitial = farRender.mock.calls.length;

      // Advance the ledger by one block: only the near card's countdown changes.
      ledgerState.current = 1001;
      act(() => {
        rerender(
          <>
            <TrackedCard subscription={nearCard} onRender={nearRender} />
            <TrackedCard subscription={farCard} onRender={farRender} />
          </>,
        );
      });

      // The near card's displayed countdown changed, so it re-renders.
      expect(nearRender.mock.calls.length).toBeGreaterThan(nearInitial);
      // The far card's countdown is unchanged, so memo skips its render.
      expect(farRender.mock.calls.length).toBe(farInitial);
    });
  });
});
