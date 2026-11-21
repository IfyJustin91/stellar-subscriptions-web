import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubStatus, type Subscription } from "@/types";
import MySubscriptionsPage from "./page";

type SubsState = {
  data: Subscription[] | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
};

let subsState: SubsState;

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: "GSUBSCRIBER",
    installed: true,
    connecting: false,
    error: null,
    connect: vi.fn(),
    network: "testnet",
  }),
}));

vi.mock("@/hooks/useSubscriptions", () => ({
  useSubscriptions: () => subsState,
}));

// The page's job here is the title and the empty state; keep its children inert.
vi.mock("@/components/subscription/SubscriptionCard", () => ({
  SubscriptionCard: ({ sub }: { sub: Subscription }) => <div>Subscription #{sub.id}</div>,
}));
vi.mock("@/components/subscription/CommittedSpend", () => ({ CommittedSpend: () => null }));
vi.mock("@/components/subscription/AllowanceBanner", () => ({ AllowanceBanner: () => null }));
vi.mock("@/components/ui/Spinner", () => ({
  Spinner: () => null,
  LoadingBlock: ({ label }: { label: string }) => <div role="status">{label}</div>,
}));

function sub(id: number, status: SubStatus): Subscription {
  return {
    id,
    subscriber: "GSUBSCRIBER",
    merchant: "GMERCHANT",
    token: "CTOKEN",
    amountPerPeriod: 10_000_000n,
    intervalLedgers: 17_280,
    totalCap: 120_000_000n,
    totalCharged: 0n,
    startLedger: 1,
    lastChargeLedger: 0,
    nextChargeLedger: 17_281,
    status,
    planId: 1,
  };
}

const loading = (): SubsState => ({ data: undefined, error: null, loading: true, reload: vi.fn() });
const loaded = (data: Subscription[]): SubsState => ({ data, error: null, loading: false, reload: vi.fn() });

describe("/subscriptions page", () => {
  beforeEach(() => {
    document.title = "Stellar Subscriptions";
    subsState = loading();
  });

  describe("document title", () => {
    it('is "My Subscriptions" while loading', async () => {
      render(<MySubscriptionsPage />);
      await waitFor(() => expect(document.title).toBe("My Subscriptions"));
    });

    it("shows the active count once subscriptions load", async () => {
      const { rerender } = render(<MySubscriptionsPage />);
      await waitFor(() => expect(document.title).toBe("My Subscriptions"));

      subsState = loaded([
        sub(1, SubStatus.Active),
        sub(2, SubStatus.Active),
        sub(3, SubStatus.Paused),
        sub(4, SubStatus.Cancelled),
        sub(5, SubStatus.Exhausted),
      ]);
      rerender(<MySubscriptionsPage />);

      await waitFor(() => expect(document.title).toBe("My Subscriptions (2)"));
    });

    it("resets to the bare title when a reload goes back to loading", async () => {
      subsState = loaded([sub(1, SubStatus.Active)]);
      const { rerender } = render(<MySubscriptionsPage />);
      await waitFor(() => expect(document.title).toBe("My Subscriptions (1)"));

      subsState = loading();
      rerender(<MySubscriptionsPage />);

      await waitFor(() => expect(document.title).toBe("My Subscriptions"));
    });

    it('shows "(0)" when the wallet has no subscriptions', async () => {
      subsState = loaded([]);
      render(<MySubscriptionsPage />);
      await waitFor(() => expect(document.title).toBe("My Subscriptions (0)"));
    });
  });

  describe("empty state", () => {
    it("prompts first-time subscribers to browse plans", () => {
      subsState = loaded([]);
      render(<MySubscriptionsPage />);

      expect(screen.getByRole("heading", { name: "No subscriptions yet" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Browse plans" })).toHaveAttribute("href", "/plans");
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("is not shown while loading", () => {
      render(<MySubscriptionsPage />);
      expect(screen.queryByText("No subscriptions yet")).not.toBeInTheDocument();
    });

    it("is not shown when the wallet has subscriptions", () => {
      subsState = loaded([sub(7, SubStatus.Active)]);
      render(<MySubscriptionsPage />);

      expect(screen.queryByText("No subscriptions yet")).not.toBeInTheDocument();
      expect(screen.getByText("Subscription #7")).toBeInTheDocument();
    });
  });
});
