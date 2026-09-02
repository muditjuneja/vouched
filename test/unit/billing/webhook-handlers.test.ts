import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleSubscriptionActive,
  handleSubscriptionCancelled,
  handleSubscriptionFailed,
  handleSubscriptionOnHold,
  planFromProductId,
  tenantIdFromMetadata,
  type SubscriptionWebhookPayload
} from "../../../src/billing/webhook-handlers";
import type { Env } from "../../../src/types/env";

vi.mock("../../../src/email/notifications", () => ({
  notifyPaymentReceipt: vi.fn(),
  notifyPaymentFailed: vi.fn(),
  notifySubscriptionCancelled: vi.fn()
}));
import { notifyPaymentFailed, notifyPaymentReceipt, notifySubscriptionCancelled } from "../../../src/email/notifications";

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({ run: async () => ({ success: true, meta: { changes: 1 } }) })
      })
    } as unknown as D1Database,
    DATASETS: {} as R2Bucket,
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
      metadata: { tenant_id: "user_1" },
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

  it("sends no email when the payload has no tenant_id in metadata", async () => {
    await handleSubscriptionActive(fakeEnv(), fakePayload({ metadata: undefined }));
    expect(notifyPaymentReceipt).not.toHaveBeenCalled();
  });
});
