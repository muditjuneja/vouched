export type BadgeStatus = "good" | "warn" | "neutral";

export interface BadgeProps {
  status: BadgeStatus;
  label: string;
}

/** A small colored pill: connection state, subscription state, anything status-shaped. */
export function Badge({ status, label }: BadgeProps) {
  return <span class={`badge badge-${status}`}>{label}</span>;
}
