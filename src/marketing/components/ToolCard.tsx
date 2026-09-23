import { Card } from "../../design";

export interface ToolCardProps {
  href: string;
  domainLabel: string;
  title: string;
  summary: string;
  toolName?: string;
  billing?: "free" | "dataforseo";
  factTypes?: string[];
  requiresConnection?: "webmaster_console" | "analytics_property" | null;
}

/** One card in the `/tools` index grid: domain label, tool name, summary, linking to its own page. */
export function ToolCard({
  href,
  domainLabel,
  title,
  summary,
  toolName,
  billing,
  factTypes
}: ToolCardProps) {
  return (
    <Card href={href} class="tool-card">
      <div class="tool-card-meta">
        <span class="tool-domain">{domainLabel}</span>
        {billing ? (
          <span class={`tool-tier-badge ${billing === "free" ? "free" : "paid"}`}>
            {billing === "free" ? "Free" : "BYOK"}
          </span>
        ) : null}
      </div>
      <h3>{title}</h3>
      {toolName ? <code class="tool-code-name">{toolName}</code> : null}
      <p class="tool-summary">{summary}</p>
      {factTypes && factTypes.length > 0 ? (
        <div class="tool-fact-chips">
          {factTypes.slice(0, 2).map((fact) => (
            <span class="tool-fact-chip">{fact}</span>
          ))}
          {factTypes.length > 2 ? <span class="tool-fact-chip-more">+{factTypes.length - 2} more</span> : null}
        </div>
      ) : null}
      <span class="tool-card-link">Docs &amp; schema →</span>
    </Card>
  );
}
