import { Badge, Callout, Table } from "../../design";
import { renderPage } from "../Layout";
import { BillingSection } from "../components/BillingSection";
import { PaymentStatusBanner } from "../components/PaymentStatusBanner";
import type { BillingData } from "../types";

function BillingPage({ data }: { data: BillingData }) {
  return (
    <>
      <h1>Billing</h1>
      <PaymentStatusBanner status={data.status} currentPeriodEnd={data.currentPeriodEnd} />
      {data.checkoutSuccess ? (
        <Callout>
          <p>Payment received. Your plan will update shortly, this page will reflect it once the confirmation finishes processing.</p>
        </Callout>
      ) : null}
      {data.topupSuccess ? (
        <Callout>
          <p>Payment received. Your wallet balance will update shortly.</p>
        </Callout>
      ) : null}
      <BillingSection data={data} />

      <section class="panel">
        <h2>Wallet history</h2>
        {data.walletLedger.length === 0 ? (
          <p class="muted">No wallet activity yet.</p>
        ) : (
          <Table headers={["Date", "Type", "Amount", "Note"]}>
            {data.walletLedger.map((entry) => (
              <tr>
                <td data-label="Date">{entry.created_at}</td>
                <td data-label="Type">
                  {entry.reason === "topup" ? <Badge status="good" label="top-up" /> : <Badge status="neutral" label="overage usage" />}
                </td>
                <td data-label="Amount">
                  {entry.delta_usd >= 0 ? "+" : ""}
                  {entry.delta_usd.toFixed(2)}
                </td>
                <td class="muted" data-label="Note">
                  {entry.reason === "topup" ? "Wallet top-up" : `Overage usage (${entry.period ?? ""})`}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </>
  );
}

export function renderBilling(data: BillingData): string {
  return renderPage({
    title: "Billing",
    activePath: "/dashboard/billing",
    user: data.user,
    notice: data.notice,
    children: <BillingPage data={data} />
  });
}

