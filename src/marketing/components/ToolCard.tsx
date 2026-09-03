import { Card } from "../../design";

export interface ToolCardProps {
  href: string;
  domainLabel: string;
  title: string;
  summary: string;
}

/** One card in the `/tools` index grid — domain label, tool name, summary, linking to its own page. */
export function ToolCard({ href, domainLabel, title, summary }: ToolCardProps) {
  return (
    <Card href={href}>
      <p class="tool-domain">{domainLabel}</p>
      <h3>{title}</h3>
      <p>{summary}</p>
    </Card>
  );
}
