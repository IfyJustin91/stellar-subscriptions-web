export type HealthScore = "good" | "at-risk" | "critical";

export interface Subscription {
  id: string;
  amount: number;
  currency?: string;
  status?: string;
}

export interface Balance {
  currency: string;
  amount: number;
}

export interface Allowance {
  currency: string;
  amount: number;
}

const LIVE_STATUSES = new Set(["active", "live", "trialing"]);

function isLive(sub: Subscription): boolean {
  if (!sub.status) return true;
  return LIVE_STATUSES.has(sub.status.toLowerCase());
}

function getBalanceFor(
  balances: Balance[],
  currency: string | undefined
): number | undefined {
  if (!currency) {
    return balances.length > 0 ? balances[0].amount : undefined;
  }
  const match = balances.find(
    (b) => b.currency.toLowerCase() === currency.toLowerCase()
  );
  return match ? match.amount : undefined;
}

function getAllowanceFor(
  allowances: Allowance[],
  currency: string | undefined
): number | undefined {
  if (!currency) {
    return allowances.length > 0 ? allowances[0].amount : undefined;
  }
  const match = allowances.find(
    (a) => a.currency.toLowerCase() === currency.toLowerCase()
  );
  return match ? match.amount : undefined;
}

export function scoreHealth(
  subs: Subscription[],
  balances: Balance[],
  allowances: Allowance[]
): HealthScore {
  const liveSubs = subs.filter(isLive);

  if (liveSubs.length === 0) {
    return "good";
  }

  let atRisk = false;

  for (const sub of liveSubs) {
    const balance = getBalanceFor(balances, sub.currency);
    const allowance = getAllowanceFor(allowances, sub.currency);

    // Critical: zero allowance for this subscription's currency.
    if (allowance !== undefined && allowance <= 0) {
      return "critical";
    }

    // Critical: insufficient balance for the next charge.
    if (balance !== undefined && balance < sub.amount) {
      return "critical";
    }

    // At-risk: balance covers fewer than 3 charges.
    if (balance !== undefined && sub.amount > 0) {
      const chargesCovered = balance / sub.amount;
      if (chargesCovered < 3) {
        atRisk = true;
      }
    }
  }

  return atRisk ? "at-risk" : "good";
}
```

```ts
import { describe, it, expect } from "vitest";
import { scoreHealth, Subscription, Balance, Allowance } from "./subscription-health";

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub_1",
    amount: 10,
    currency: "USD",
    status: "active",
    ...overrides,
  };
}

function balance(amount: number, currency = "USD"): Balance {
  return { amount, currency };
}

function allowance(amount: number, currency = "USD"): Allowance {
  return { amount, currency };
}

describe("scoreHealth", () => {
  it("returns good when no subscriptions exist", () => {
    expect(scoreHealth([], [balance(100)], [allowance(100)])).toBe("good");
  });

  it("returns good when balance covers 3 or more charges", () => {
    expect(
      scoreHealth([sub({ amount: 10 })], [balance(30)], [allowance(100)])
    ).toBe("good");
  });

  it("returns at-risk when balance covers fewer than 3 charges", () => {
    expect(
      scoreHealth([sub({ amount: 10 })], [balance(25)], [allowance(100)])
    ).toBe("at-risk");
  });

  it("returns critical when balance is insufficient for the next charge", () => {
    expect(
      scoreHealth([sub({ amount: 10 })], [balance(5)], [allowance(100)])
    ).toBe("critical");
  });

  it("returns critical when allowance is zero", () => {
    expect(
      scoreHealth([sub({ amount: 10 })], [balance(100)], [allowance(0)])
    ).toBe("critical");
  });

  it("ignores non-live subscriptions", () => {
    expect(
      scoreHealth(
        [sub({ amount: 10, status: "canceled" })],
        [balance(0)],
        [allowance(0)]
      )
    ).toBe("good");
  });

  it("returns critical if any live subscription is critical", () => {
    expect(
      scoreHealth(
        [sub({ id: "a", amount: 10 }), sub({ id: "b", amount: 100 })],
        [balance(50)],
        [allowance(100)]
      )
    ).toBe("critical");
  });

  it("returns at-risk if any live subscription is at-risk but none critical", () => {
    expect(
      scoreHealth(
        [sub({ id: "a", amount: 10 }), sub({ id: "b", amount: 20 })],
        [balance(50)],
        [allowance(100)]
      )
    ).toBe("at-risk");
  });

  it("matches balances and allowances by currency", () => {
    expect(
      scoreHealth(
        [sub({ amount: 10, currency: "EUR" })],
        [balance(100, "USD"), balance(5, "EUR")],
        [allowance(100, "USD"), allowance(100, "EUR")]
      )
    ).toBe("critical");
  });
});