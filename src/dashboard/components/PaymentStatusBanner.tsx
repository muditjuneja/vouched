import { Callout } from "../../design";
import { PAYMENT_FAILURE_GRACE_DAYS, type SubscriptionStatus } from "../../db/subscriptions";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A warning shown on Overview + Billing when a payment has failed and
 * getEffectivePlan is only keeping the tenant's paid plan alive through
 * its grace period, not a real fix. Before this, that grace period was
 * completely invisible in the app: a tenant only found out via the
 * payment-failed email (if hasEmail(env)) or by suddenly losing access.
 */
export function PaymentStatusBanner({
  status,
  currentPeriodEnd
}: {
  status: SubscriptionStatus | null;
  currentPeriodEnd: string | null;
}) {
  if (status !== "on_hold" && status !== "failed") return null;

  const daysLeft = currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(currentPeriodEnd).getTime() + PAYMENT_FAILURE_GRACE_DAYS * MS_PER_DAY - Date.now()) / MS_PER_DAY))
    : null;

  return (
    <Callout>
      <p>
        <strong>Your last payment failed.</strong>{" "}
        {daysLeft !== null
          ? `You have ${daysLeft} day${daysLeft === 1 ? "" : "s"} left before losing access to your paid plan.`
          : "Update your payment method to avoid losing access to your paid plan."}{" "}
        <a href="/billing/portal">Fix payment →</a>
      </p>
    </Callout>
  );
}
