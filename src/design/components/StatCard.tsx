import type { BadgeStatus } from "./Badge";

export interface StatCardProps {
  label: string;
  /** Caller pre-formats this (e.g. "$4.00 / $20.00", "12"): matches Table's own "just render, don't format" convention. */
  value: string;
  sublabel?: string;
  status?: BadgeStatus;
}

/** A single at-a-glance metric tile, for an overview/dashboard-home page. */
export function StatCard({ label, value, sublabel, status }: StatCardProps) {
  return (
    <div class={status ? `stat-card stat-card-${status}` : "stat-card"}>
      <p class="stat-card-label">{label}</p>
      <p class="stat-card-value">{value}</p>
      {sublabel ? <p class="stat-card-sublabel muted">{sublabel}</p> : null}
    </div>
  );
}
