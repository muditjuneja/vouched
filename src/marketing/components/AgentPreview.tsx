import { MCP_SERVER_NAME } from "../../lib/product";
import { TOOL_MANIFEST } from "../../mcp/manifest";

const EXPOSED_TOOL_COUNT = TOOL_MANIFEST.filter((tool) => tool.implemented).length;

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

/**
 * Illustrative, not live: the numbers are made up, but every tool name,
 * argument, fact type, source class and confidence below is what the real
 * tool emits (see src/domains/, src/envelope/provenance.ts). Keep it that
 * way: the envelope never names the upstream vendor, so neither does the
 * agent's reply here.
 */
const SCENARIOS: Scenario[] = [
  {
    id: "keywords",
    tabLabel: "Keyword Research",
    userPrompt: "Find keyword opportunities for 'open source seo' with search volume and difficulty.",
    toolCall: 'research_keywords({ seedKeywords: ["open source seo"] })',
    sourceClass: "search_index",
    confidence: "0.75",
    freshness: "just now",
    factType: "seo.keyword_opportunity",
    rows: [
      { label: "open source seo tools", meta: "Vol: 2,400 · KD: 28 · CPC: $3.20" },
      { label: "self hosted search console", meta: "Vol: 880 · KD: 14 · CPC: $1.90" },
      { label: "mcp seo server", meta: "Vol: 1,600 · KD: 19 · CPC: $4.10" }
    ],
    agentNote:
      "Search-index estimates (confidence 0.75, modeled rather than first-party). 'self hosted search console' is the easiest win: KD 14 with 880 monthly searches."
  },
  {
    id: "serp",
    tabLabel: "Live SERP",
    userPrompt: "Where does vouchedhq.com rank for 'mcp seo server' right now, and is Google showing an AI Overview?",
    toolCall: 'inspect_serp({ keyword: "mcp seo server" })',
    sourceClass: "live_serp",
    confidence: "0.85",
    freshness: "just now",
    factType: "serp.result",
    rows: [
      { label: "#3 vouchedhq.com/docs/tools", meta: "serp.result · 0.85" },
      { label: "#7 vouchedhq.com/vs/open-seo", meta: "serp.result · 0.85" },
      { label: "AI Overview", meta: "serp.feature · 0.6" }
    ],
    agentNote:
      "Live Google results (confidence 0.85): vouchedhq.com ranks #3 and #7. An AI Overview is showing too, reported at lower confidence (0.6) because SERP features change more often than rankings."
  },
  {
    id: "gsc",
    tabLabel: "First-Party GSC",
    userPrompt: "Which pages lost the most CTR over the last 28 days compared with the 28 before?",
    toolCall:
      'get_search_performance({ domain: "vouchedhq.com", startDate: "2026-08-26", endDate: "2026-09-22", dimensions: ["page"], compareToPreviousPeriod: true })',
    sourceClass: "webmaster_console",
    confidence: "1.0",
    freshness: "just now",
    factType: "gsc.query_performance",
    rows: [
      { label: "/docs/tools", meta: "CTR 2.3% (was 4.1%) · Pos 5.8 (was 4.9)" },
      { label: "/pricing", meta: "CTR 3.0% (was 3.9%) · Pos 6.2 (was 6.0)" },
      { label: "/vs/open-seo", meta: "CTR 5.1% (was 5.6%) · Pos 3.4 (was 3.3)" }
    ],
    agentNote:
      "Your own Search Console data (confidence 1.0). /docs/tools dropped the most: CTR fell from 4.1% to 2.3% as its average position slipped from 4.9 to 5.8."
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
      tabs.forEach(function (b) { b.classList.remove('is-active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');

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
          <code>{MCP_SERVER_NAME}</code> · Streamable HTTP
        </div>
        <span style="font-size:0.65rem; color:#857a6c;">{EXPOSED_TOOL_COUNT} tools</span>
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
        <span>Example output · every fact carries its source and confidence</span>
        <button type="button" class="agent-copy-prompt" data-copy-prompt>
          Copy Prompt
        </button>
      </div>

      <script dangerouslySetInnerHTML={{ __html: PREVIEW_SCRIPT }} />
    </div>
  );
}
