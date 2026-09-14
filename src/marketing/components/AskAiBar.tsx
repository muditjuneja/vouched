const ASK = encodeURIComponent(
  "What is Vouched, the open-source MCP server for SEO data with provenance? How do I self-host vouched-seo-mcp or use Vouched Cloud?"
);

export function AskAiBar() {
  return (
    <div class="ask-ai">
      <div class="ask-ai-shell">
        <span class="ask-ai-prompt">Ask AI about Vouched</span>
        <div class="ask-ai-models">
          <a href={`https://chatgpt.com/?q=${ASK}`}>ChatGPT</a>
          <a href={`https://claude.ai/new?q=${ASK}`}>Claude</a>
          <a href={`https://www.perplexity.ai/search?q=${ASK}`}>Perplexity</a>
        </div>
      </div>
    </div>
  );
}
