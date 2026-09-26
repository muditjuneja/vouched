import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handlePaymentSucceeded,
  topupCreditUsd,
  handleSubscriptionActive,
  handleSubscriptionCancelled,
  handleSubscriptionFailed,
  handleSubscriptionOnHold,
  planFromProductId,
  tenantIdFromMetadata,
  type PaymentWebhookPayload,
  type SubscriptionWebhookPayload
} from "../../../src/billing/webhook-handlers";
import type { Env } from "../../../src/types/env";

vi.mock("../../../src/email/notifications", () => ({
  notifyPaymentReceipt: vi.fn(async () => true),
  notifyPaymentFailed: vi.fn(async () => true),
  notifySubscriptionCancelled: vi.fn(async () => true),
  notifyWalletTopup: vi.fn(async () => true)
}));
import { notifyPaymentFailed, notifyPaymentReceipt, notifySubscriptionCancelled, notifyWalletTopup } from "../../../src/email/notifications";

// A real "send once" ledger (claim, send, release on failure), so retried
// and follow-up events can be tested.
const sentKeys = new Set<string>();
vi.mock("../../../src/email/dedup", () => ({
  sendOnce: vi.fn(async (_db: unknown, tenantId: string, key: string, send: () => Promise<boolean>) => {
    const k = `${tenantId}|${key}`;
    if (sentKeys.has(k)) return false;
    sentKeys.add(k);
    const sent = await send();
    if (!sent) sentKeys.delete(k);
    return sent;
  })
}));

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({ run: async () => ({ success: true, meta: { changes: 1 } }) })
      })
    } as unknown as D1Database,
    DATASETS: {} as R2Bucket,
    CACHE: {} as KVNamespace,
    MCP_BEARER_TOKEN: "x",
    DODO_PRODUCT_ID_PRO: "prod_pro_123",
    DODO_PRODUCT_ID_TEAM: "prod_team_456",
    ...overrides
  };
}

function fakePayload(overrides: Partial<SubscriptionWebhookPayload["data"]> = {}): SubscriptionWebhookPayload {
  return {
    type: "subscription.active",
    data: {
      subscription_id: "sub_123",
      product_id: "prod_pro_123",
      status: "active",
      next_billing_date: "2026-10-01T00:00:00Z",
      customer: { customer_id: "cust_1" },
      metadata: { tenant_id: "user_1", credit_usd: "10.00" },
      ...overrides
    }
  };
}

describe("tenantIdFromMetadata", () => {
  it("extracts a string tenant_id", () => {
    expect(tenantIdFromMetadata({ tenant_id: "user_abc" })).toBe("user_abc");
  });

  it("returns null when metadata is missing entirely", () => {
    expect(tenantIdFromMetadata(undefined)).toBeNull();
  });

  it("returns null when tenant_id is absent or not a string", () => {
    expect(tenantIdFromMetadata({})).toBeNull();
    expect(tenantIdFromMetadata({ tenant_id: 12345 })).toBeNull();
  });
});

describe("planFromProductId", () => {
  it("maps the configured Pro/Team product ids to their plans", () => {
    const env = fakeEnv();
    expect(planFromProductId(env, "prod_pro_123")).toBe("pro");
    expect(planFromProductId(env, "prod_team_456")).toBe("team");
  });

  it("defaults an unrecognized product id to free rather than guessing", () => {
    expect(planFromProductId(fakeEnv(), "prod_someone_elses_product")).toBe("free");
  });
});

describe("Dodo event handlers' lifecycle-email calls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentKeys.clear();
  });

  it("handleSubscriptionActive syncs and sends a payment receipt", async () => {
    await handleSubscriptionActive(fakeEnv(), fakePayload());
    expect(notifyPaymentReceipt).toHaveBeenCalledWith(expect.anything(), "user_1", "pro");
  });

  it("handleSubscriptionOnHold sends a payment-failed notice", async () => {
    await handleSubscriptionOnHold(fakeEnv(), fakePayload({ status: "on_hold" }));
    expect(notifyPaymentFailed).toHaveBeenCalledWith(expect.anything(), "user_1");
  });

  it("handleSubscriptionFailed sends a payment-failed notice", async () => {
    await handleSubscriptionFailed(fakeEnv(), fakePayload({ status: "failed" }));
    expect(notifyPaymentFailed).toHaveBeenCalledWith(expect.anything(), "user_1");
  });

  it("handleSubscriptionCancelled sends a cancellation confirmation", async () => {
    await handleSubscriptionCancelled(fakeEnv(), fakePayload({ status: "cancelled" }));
    expect(notifySubscriptionCancelled).toHaveBeenCalledWith(expect.anything(), "user_1");
  });

  it("sends each receipt once, however many times Dodo retries the delivery", async () => {
    await handleSubscriptionActive(fakeEnv(), fakePayload());
    await handleSubscriptionActive(fakeEnv(), fakePayload());
    expect(notifyPaymentReceipt).toHaveBeenCalledTimes(1);
  });

  it("sends a fresh receipt for the next billing period, and for a plan change", async () => {
    await handleSubscriptionActive(fakeEnv(), fakePayload());
    await handleSubscriptionActive(fakeEnv(), fakePayload({ next_billing_date: "2026-11-01T00:00:00Z" }));
    await handleSubscriptionActive(fakeEnv(), fakePayload({ product_id: "prod_team_456", next_billing_date: "2026-11-01T00:00:00Z" }));
    expect(notifyPaymentReceipt).toHaveBeenCalledTimes(3);
    expect(notifyPaymentReceipt).toHaveBeenLastCalledWith(expect.anything(), "user_1", "team");
  });

  it("sends one payment-failed email when on_hold is followed by failed", async () => {
    await handleSubscriptionOnHold(fakeEnv(), fakePayload({ status: "on_hold" }));
    await handleSubscriptionFailed(fakeEnv(), fakePayload({ status: "failed" }));
    expect(notifyPaymentFailed).toHaveBeenCalledTimes(1);
  });

  it("tries again on the next delivery when the email itself failed to send", async () => {
    vi.mocked(notifyPaymentReceipt).mockResolvedValueOnce(false);
    await handleSubscriptionActive(fakeEnv(), fakePayload());
    await handleSubscriptionActive(fakeEnv(), fakePayload());
    await handleSubscriptionActive(fakeEnv(), fakePayload());
    expect(notifyPaymentReceipt).toHaveBeenCalledTimes(2);
  });

  it("sends one cancellation email per subscription, even on a retried delivery", async () => {
    await handleSubscriptionCancelled(fakeEnv(), fakePayload({ status: "cancelled" }));
    await handleSubscriptionCancelled(fakeEnv(), fakePayload({ status: "cancelled" }));
    expect(notifySubscriptionCancelled).toHaveBeenCalledTimes(1);
  });

  it("sends no email when the payload has no tenant_id in metadata", async () => {
    await handleSubscriptionActive(fakeEnv(), fakePayload({ metadata: undefined }));
    expect(notifyPaymentReceipt).not.toHaveBeenCalled();
  });
});

/** A tiny in-memory fake of wallet_ledger + subscriptions.wallet_balance_usd, enough to exercise creditWallet's real idempotency logic through handlePaymentSucceeded. */
function fakeWalletDb() {
  const appliedPaymentIds = new Set<string>();
  const balances = new Map<string, number>();

  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.startsWith("INSERT OR IGNORE INTO wallet_ledger")) {
                const [, , dodoPaymentId] = args as [string, number, string];
                if (appliedPaymentIds.has(dodoPaymentId)) return { success: true, meta: { changes: 0 } };
                appliedPaymentIds.add(dodoPaymentId);
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.startsWith("INSERT INTO subscriptions")) {
                const [tenantId, amountUsd] = args as [string, number];
                balances.set(tenantId, (balances.get(tenantId) ?? 0) + amountUsd);
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 1 } };
            }
          };
        }
      };
    }
  };

  return { db: db as unknown as D1Database, balances };
}

function fakePaymentPayload(overrides: Partial<PaymentWebhookPayload["data"]> = {}): PaymentWebhookPayload {
  return {
    type: "payment.succeeded",
    data: {
      payment_id: "pay_123",
      total_amount: 1000, // $10.00 in cents
      currency: "USD",
      tax: 0,
      product_cart: [{ product_id: "prod_wallet_topup", quantity: 1 }],
      customer: { customer_id: "cust_1" },
      metadata: { tenant_id: "user_1", credit_usd: "10.00" },
      ...overrides
    }
  };
}

describe("handlePaymentSucceeded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("credits the wallet and sends a top-up email when the cart contains the wallet top-up product", async () => {
    const { db, balances } = fakeWalletDb();
    const env = fakeEnv({ DB: db, DODO_PRODUCT_ID_WALLET_TOPUP: "prod_wallet_topup" });

    await handlePaymentSucceeded(env, fakePaymentPayload());

    expect(balances.get("user_1")).toBe(10);
    expect(notifyWalletTopup).toHaveBeenCalledWith(env, "user_1", 10);
  });

  it("ignores a retried webhook delivery for the same payment_id (no double-credit)", async () => {
    const { db, balances } = fakeWalletDb();
    const env = fakeEnv({ DB: db, DODO_PRODUCT_ID_WALLET_TOPUP: "prod_wallet_topup" });

    await handlePaymentSucceeded(env, fakePaymentPayload());
    await handlePaymentSucceeded(env, fakePaymentPayload());

    expect(balances.get("user_1")).toBe(10); // not 20
    expect(notifyWalletTopup).toHaveBeenCalledTimes(1);
  });

  it("ignores a subscription's periodic invoice payment (cart doesn't contain the wallet top-up product)", async () => {
    const { db, balances } = fakeWalletDb();
    const env = fakeEnv({ DB: db, DODO_PRODUCT_ID_WALLET_TOPUP: "prod_wallet_topup" });

    await handlePaymentSucceeded(env, fakePaymentPayload({ product_cart: [{ product_id: "prod_pro_123", quantity: 1 }] }));

    expect(balances.size).toBe(0);
    expect(notifyWalletTopup).not.toHaveBeenCalled();
  });

  it("does nothing when the deployment has no wallet top-up product configured", async () => {
    const { db, balances } = fakeWalletDb();
    const env = fakeEnv({ DB: db, DODO_PRODUCT_ID_WALLET_TOPUP: undefined });

    await handlePaymentSucceeded(env, fakePaymentPayload());

    expect(balances.size).toBe(0);
    expect(notifyWalletTopup).not.toHaveBeenCalled();
  });

  it("does nothing when the payload has no tenant_id in metadata", async () => {
    const { db, balances } = fakeWalletDb();
    const env = fakeEnv({ DB: db, DODO_PRODUCT_ID_WALLET_TOPUP: "prod_wallet_topup" });

    await handlePaymentSucceeded(env, fakePaymentPayload({ metadata: undefined }));

    expect(balances.size).toBe(0);
    expect(notifyWalletTopup).not.toHaveBeenCalled();
  });
});

describe("topupCreditUsd: the wallet gets the top-up's price, not the card total", () => {
  const base = fakePaymentPayload().data;

  it("leaves out tax added on top of a tax-exclusive price", () => {
    expect(topupCreditUsd({ ...base, total_amount: 1180, tax: 180 })).toBe(10);
  });

  it("credits dollars when the card paid in another currency", () => {
    // ₹850 plus ₹153 GST, settled to Dodo as $10.02 of which $1.80 is tax
    const inr = { ...base, currency: "INR", total_amount: 100300, tax: 15300, settlement_currency: "USD", settlement_amount: 1202, settlement_tax: 180 };
    expect(topupCreditUsd(inr)).toBe(10);
  });

  it("credits only what was paid when a payment came up short", () => {
    expect(topupCreditUsd({ ...base, total_amount: 500 })).toBe(5);
  });

  it("credits nothing for a payment of $0", () => {
    expect(topupCreditUsd({ ...base, total_amount: 0 })).toBe(0);
  });

  it("falls back to the pre-tax amount paid for checkouts created before the price was recorded", () => {
    expect(topupCreditUsd({ ...base, total_amount: 1180, tax: 180, metadata: { tenant_id: "user_1" } })).toBe(10);
  });
});

describe("handlePaymentSucceeded with nothing paid", () => {
  it("records no credit and sends no 'credited' email", async () => {
    const { db, balances } = fakeWalletDb();
    const env = fakeEnv({ DB: db, DODO_PRODUCT_ID_WALLET_TOPUP: "prod_wallet_topup" });

    await handlePaymentSucceeded(env, fakePaymentPayload({ total_amount: 0 }));

    expect(balances.size).toBe(0);
    expect(notifyWalletTopup).not.toHaveBeenCalled();
  });
});
