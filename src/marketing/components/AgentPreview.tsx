export interface Scenario {
  id: string;
  tabLabel: string;
  userPrompt: string;
  toolCall: string;
  sourceClass: string;
  confidence: string;
  freshness: string;
  factType: string;
  rows: Array<{ label: string; meta: string }>;
  agentNote: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: "keywords",
    tabLabel: "Keyword Research",
    userPrompt: "Find keyword opportunities for 'open source seo' with search volume and difficulty.",
    toolCall: 'research_keywords({ seedKeywords: ["open source seo"] })',
    sourceClass: "search_index",
    confidence: "0.75",
    freshness: "2h ago",
    factType: "seo.keyword_opportunity",
    rows: [
      { label: "open source seo tools", meta: "Vol: 2,400 · KD: 28 · CPC: $3.20" },
      { label: "self hosted search console", meta: "Vol: 880 · KD: 14 · CPC: $1.90" },
      { label: "mcp seo server", meta: "Vol: 1,600 · KD: 19 · CPC: $4.10" }
    ],
    agentNote:
      "DataForSEO search index (confidence 0.75). 'self hosted search console' has KD 14 with 880 monthly searches."
  },
  {
    id: "serp",
    tabLabel: "Live SERP & Citations",
    userPrompt: "Snapshot Google SERP for 'best developer seo tool', then check organic ranks and AI Overview citations.",
    toolCall: 'inspect_serp({ keyword: "best developer seo tool" })',
    sourceClass: "live_serp",
    confidence: "0.85",
    freshness: "3m ago",
    factType: "serp.snapshot",
    rows: [
      { label: "1. vouchedhq.com", meta: "Title: Open-source SEO MCP · Snippet: Verified facts..." },
      { label: "2. github.com/open-seo", meta: "Stars: 1.2k · Lang: TypeScript" },
      { label: "AI Overview Citation", meta: "Source: vouchedhq.com/docs" }
    ],
    agentNote:
      "Live SERP (confidence 0.85). Position #1 confirmed. Google AI Overview cites vouchedhq.com/docs as a source."
  },
  {
    id: "gsc",
    tabLabel: "First-Party GSC",
    userPrompt: "Which pages had the largest CTR drops over the past 28 days? Pull Search Console data.",
    toolCall: 'get_search_performance({ domain: "vouchedhq.com", startDate: "2026-08-25", endDate: "2026-09-22", dimensions: ["page"] })',
    sourceClass: "webmaster_console",
    confidence: "1.0",
    freshness: "15m ago",
    factType: "gsc.search_performance",
    rows: [
      { label: "/blog/mcp-setup", meta: "1,240 clicks (+34%) · Avg pos: 4.2" },
      { label: "/docs/tools", meta: "310 clicks (-12%) · CTR: 2.3% vs 4.1%" },
      { label: "/vs/open-seo", meta: "890 clicks (+55%) · Avg pos: 2.1" }
    ],
    agentNote:
      "First-party Google Search Console (confidence 1.0, unmodeled). /docs/tools CTR fell from 4.1% to 2.3%."
  }
];

const PREVIEW_SCRIPT = `
(function () {
  var root = document.querySelector('[data-agent-preview]');
  if (!root) return;
  var tabs = root.querySelectorAll('[data-tab-target]');
  var scenarios = root.querySelectorAll('[data-scenario-id]');
  var copyBtn = root.querySelector('[data-copy-prompt]');

  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.getAttribute('data-tab-target');
      tabs.forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');

      scenarios.forEach(function (s) {
        if (s.getAttribute('data-scenario-id') === targetId) {
          s.classList.add('is-active');
        } else {
          s.classList.remove('is-active');
        }
      });
    });
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var activeScenario = root.querySelector('.agent-scenario.is-active');
      if (!activeScenario) return;
      var promptEl = activeScenario.querySelector('.agent-user-prompt');
      if (!promptEl) return;
      var text = promptEl.textContent.trim();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          var original = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(function () { copyBtn.textContent = original; }, 1800);
        });
      }
    });
  }
})();
`;

export function AgentPreview() {
  return (
    <div class="agent-preview" data-agent-preview>
      <div class="agent-preview-bar">
        <div class="agent-preview-dots" aria-hidden="true">
          <span class="agent-dot red" />
          <span class="agent-dot yellow" />
          <span class="agent-dot green" />
        </div>
        <div class="agent-preview-server">
          <span class="agent-status-indicator" />
          <code>vouched-seo-mcp</code> · HTTP stream
        </div>
        <span style="font-size:0.65rem; color:#857a6c;">18 tools</span>
      </div>

      <div class="agent-preview-tabs" role="tablist">
        {SCENARIOS.map((s, index) => (
          <button
            type="button"
            class={index === 0 ? "agent-tab-btn is-active" : "agent-tab-btn"}
            data-tab-target={s.id}
            role="tab"
            aria-selected={index === 0 ? "true" : "false"}
          >
            {s.tabLabel}
          </button>
        ))}
      </div>

      <div class="agent-preview-body">
        {SCENARIOS.map((s, index) => (
          <div
            class={index === 0 ? "agent-scenario is-active" : "agent-scenario"}
            data-scenario-id={s.id}
            role="tabpanel"
          >
            <div class="agent-msg">
              <span class="agent-msg-role">Claude Prompt</span>
              <div class="agent-user-prompt">{s.userPrompt}</div>
            </div>

            <div class="agent-tool-call">
              <span class="agent-tool-pill">MCP CALL</span>
              <code>{s.toolCall}</code>
            </div>

            <div class="agent-receipt-card">
              <div class="agent-receipt-header">
                <span class="agent-receipt-title">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  Typed Envelope · {s.factType}
                </span>
                <div class="agent-receipt-tags">
                  <span class="receipt-tag source">{s.sourceClass} · {s.confidence}</span>
                  <span class="receipt-tag">{s.freshness}</span>
                </div>
              </div>

              <div class="agent-receipt-rows">
                {s.rows.map((row) => (
                  <div class="agent-receipt-row">
                    <span style="color:#f3eadc; font-weight:500;">{row.label}</span>
                    <span class="val">{row.meta}</span>
                  </div>
                ))}
              </div>
            </div>

            <div class="agent-msg">
              <span class="agent-msg-role">Claude Response</span>
              <div class="agent-response">{s.agentNote}</div>
            </div>
          </div>
        ))}
      </div>

      <div class="agent-preview-footer">
        <span>Structured facts with provenance, not unverified text</span>
        <button type="button" class="agent-copy-prompt" data-copy-prompt>
          Copy Prompt
        </button>
      </div>

      <script dangerouslySetInnerHTML={{ __html: PREVIEW_SCRIPT }} />
    </div>
  );
}
