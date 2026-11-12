import { DISPLAY_NAME, SITE_DOMAIN, SITE_URL } from "../lib/product";
import { htmlToText } from "./client";

/**
 * The one visual shell every transactional email renders through, in the
 * marketing site's own language (src/marketing/styles.ts): warm paper on a
 * matte ground, ink text, moss and gold accents, Fraunces for display,
 * Instrument Sans for body, IBM Plex Mono for labels and numerals.
 *
 * Email clients are not browsers, so this is deliberately old-fashioned:
 * table layout, every style inline, a 600px column. The <style> block only
 * adds progressive extras (web fonts, dark mode, phone padding) for the
 * clients that honor it (Apple Mail, iOS, Outlook.com); everywhere else the
 * inline light theme with Georgia/Helvetica fallbacks is what renders.
 *
 * Each email is described as content (EmailContent) rather than hand-written
 * HTML, so the plain-text copy is rendered from the same source instead of
 * being scraped back out of the markup.
 */

/** Light palette, inline. Dark equivalents live in the <style> block below. */
const C = {
  matte: "#e6d7c0",
  sheet: "#f3eadc",
  paper: "#efe6d6",
  ink: "#1a1916",
  text: "#161310",
  muted: "#5c564e",
  border: "#d4c8ae",
  moss: "#3f5340",
  gold: "#c9953a"
} as const;

const FONT_DISPLAY = `'Fraunces', 'Iowan Old Style', Georgia, 'Times New Roman', serif`;
const FONT_BODY = `'Instrument Sans', 'Segoe UI', Helvetica, Arial, sans-serif`;
const FONT_MONO = `'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace`;

/**
 * Body copy. `html` fields are authored here, not user input: anything a
 * user or a third party supplied (a key label, an OAuth client's name, an
 * email address) must go through escapeHtml before it's interpolated.
 */
export type EmailBlock =
  | { kind: "p"; html: string }
  | { kind: "steps"; items: { title: string; html: string }[] }
  | { kind: "facts"; title?: string; rows: { label: string; value: string }[] }
  | { kind: "note"; html: string }
  | { kind: "code"; label?: string; text: string }
  /** Where the email's `cta` button goes, when not at the end. */
  | { kind: "cta" };

export interface EmailContent {
  /** The inbox preview line shown after the subject. */
  preheader: string;
  /** Small mono label above the heading ("Welcome", "Billing"). */
  eyebrow: string;
  /** Authored HTML: `<em>` renders in Fraunces italic, the brand's signature. */
  heading: string;
  blocks: EmailBlock[];
  cta?: { label: string; href: string };
  /** Why this person got the email, shown in the footer. */
  reason?: string;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const DEFAULT_REASON = `You're receiving this because you have a ${DISPLAY_NAME} account.`;

export function renderEmail(content: EmailContent): { html: string; text: string } {
  return { html: renderHtml(content), text: renderText(content) };
}

// ---------------------------------------------------------------- HTML

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;1,9..144,500&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;600&display=swap');
  body { margin: 0; padding: 0; }
  a { color: ${C.ink}; }
  @media (max-width: 620px) {
    .e-pad { padding-left: 24px !important; padding-right: 24px !important; }
    .e-outer { padding: 12px 8px !important; }
    .e-h1 { font-size: 27px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .e-matte { background: #14110e !important; }
    .e-sheet { background: #1b1713 !important; border-color: #3c342a !important; }
    .e-paper { background: #221d18 !important; border-color: #3c342a !important; }
    .e-text, .e-text a { color: #f2e8d6 !important; }
    .e-muted, .e-muted a { color: #b3a794 !important; }
    .e-moss { color: #8aa07a !important; }
    .e-rule { border-color: #3c342a !important; }
    .e-gold { border-color: #d4a256 !important; }
    .e-btn { background: #f2e8d6 !important; }
    .e-btn a { color: #1b1713 !important; }
  }
`;

function renderHtml(c: EmailContent): string {
  const ctaHtml = c.cta ? renderCta(c.cta) : "";
  const blocks = c.blocks.map((b) => (b.kind === "cta" ? ctaHtml : renderBlock(b))).join("");
  const cta = c.blocks.some((b) => b.kind === "cta") ? "" : ctaHtml;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(htmlToText(c.heading))}</title>
<style>${STYLE}</style>
</head>
<body class="e-matte" style="margin:0;padding:0;background:${C.matte};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(c.preheader)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-matte" style="background:${C.matte};">
<tr><td align="center" class="e-outer" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
  <tr><td class="e-sheet" style="background:${C.sheet};border:1px solid ${C.border};border-radius:8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td class="e-pad e-rule" style="padding:22px 40px;border-bottom:1px solid ${C.border};">
      <a href="${SITE_URL}" style="text-decoration:none;">
        <img src="${SITE_URL}/brand/icon-512.png" width="30" height="30" alt="" style="display:inline-block;vertical-align:middle;border:0;border-radius:6px;">
        <span class="e-text" style="display:inline-block;vertical-align:middle;margin-left:10px;font-family:${FONT_DISPLAY};font-style:italic;font-weight:500;font-size:22px;color:${C.ink};">${DISPLAY_NAME}</span>
      </a>
    </td></tr>
    <tr><td class="e-pad" style="padding:40px 40px 8px;">
      <div class="e-moss" style="font-family:${FONT_MONO};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${C.moss};margin:0 0 14px;">${escapeHtml(c.eyebrow)}</div>
      <h1 class="e-text e-h1" style="margin:0 0 22px;font-family:${FONT_DISPLAY};font-weight:500;font-size:32px;line-height:1.15;letter-spacing:-0.01em;color:${C.text};">${c.heading}</h1>
      ${blocks}
      ${cta}
    </td></tr>
    <tr><td class="e-pad" style="padding:16px 40px 36px;">
      <p class="e-muted" style="margin:0;font-family:${FONT_BODY};font-size:14px;line-height:1.6;color:${C.muted};">— The ${DISPLAY_NAME} team</p>
    </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:24px 16px 8px;">
    <p class="e-muted" style="margin:0 0 8px;font-family:${FONT_MONO};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};">SEO facts your agent can vouch for</p>
    <p class="e-muted" style="margin:0;font-family:${FONT_BODY};font-size:12px;line-height:1.6;color:${C.muted};">
      <a href="${SITE_URL}/dashboard" style="color:${C.muted};">Dashboard</a> &nbsp;·&nbsp; <a href="${SITE_URL}" style="color:${C.muted};">${SITE_DOMAIN}</a><br>
      ${escapeHtml(c.reason ?? DEFAULT_REASON)}
    </p>
  </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

const P_STYLE = `margin:0 0 18px;font-family:${FONT_BODY};font-size:16px;line-height:1.6;color:${C.text};`;

function renderBlock(b: Exclude<EmailBlock, { kind: "cta" }>): string {
  switch (b.kind) {
    case "p":
      return `<p class="e-text" style="${P_STYLE}">${b.html}</p>`;

    case "note":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;"><tr>
        <td class="e-paper e-gold" style="background:${C.paper};border-left:3px solid ${C.gold};padding:14px 18px;border-radius:0 6px 6px 0;">
          <p class="e-text" style="margin:0;font-family:${FONT_BODY};font-size:15px;line-height:1.55;color:${C.text};">${b.html}</p>
        </td></tr></table>`;

    case "code":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;"><tr>
        <td class="e-paper" style="background:${C.paper};border:1px solid ${C.border};border-radius:6px;padding:14px 18px;">
          ${b.label ? `<div class="e-muted" style="font-family:${FONT_MONO};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};margin:0 0 6px;">${escapeHtml(b.label)}</div>` : ""}
          <div class="e-text" style="font-family:${FONT_MONO};font-size:14px;line-height:1.5;color:${C.text};word-break:break-word;">${escapeHtml(b.text)}</div>
        </td></tr></table>`;

    case "steps": {
      const rows = b.items
        .map(
          (item, i) => `<tr>
          <td valign="top" class="e-rule" style="width:44px;padding:16px 0;border-top:1px dashed ${C.border};">
            <span class="e-moss" style="font-family:${FONT_MONO};font-size:13px;font-weight:500;color:${C.moss};">${String(i + 1).padStart(2, "0")}</span>
          </td>
          <td valign="top" class="e-rule" style="padding:15px 0 16px;border-top:1px dashed ${C.border};">
            <div class="e-text" style="font-family:${FONT_BODY};font-size:16px;font-weight:600;line-height:1.4;color:${C.text};margin:0 0 4px;">${escapeHtml(item.title)}</div>
            <div class="e-muted" style="font-family:${FONT_BODY};font-size:15px;line-height:1.55;color:${C.muted};">${item.html}</div>
          </td></tr>`
        )
        .join("");
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-rule" style="margin:4px 0 24px;border-bottom:1px dashed ${C.border};">${rows}</table>`;
    }

    case "facts": {
      const rows = b.rows
        .map(
          (r, i) => `<tr>
          <td class="e-text e-rule" style="padding:11px 18px;${i ? `border-top:1px solid ${C.border};` : ""}font-family:${FONT_BODY};font-size:14px;line-height:1.45;color:${C.text};">${escapeHtml(r.label)}</td>
          <td align="right" class="e-moss e-rule" style="padding:11px 18px;${i ? `border-top:1px solid ${C.border};` : ""}font-family:${FONT_MONO};font-size:13px;line-height:1.45;color:${C.moss};white-space:nowrap;">${escapeHtml(r.value)}</td>
        </tr>`
        )
        .join("");
      const title = b.title
        ? `<div class="e-muted" style="font-family:${FONT_MONO};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};margin:0 0 8px;">${escapeHtml(b.title)}</div>`
        : "";
      return `<div style="margin:4px 0 24px;">${title}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-paper" style="background:${C.paper};border:1px solid ${C.border};border-radius:6px;border-collapse:separate;">${rows}</table></div>`;
    }
  }
}

function renderCta(cta: { label: string; href: string }): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 30px;"><tr>
    <td class="e-btn" style="background:${C.ink};border-radius:4px;">
      <a href="${escapeHtml(cta.href)}" style="display:inline-block;padding:14px 24px;font-family:${FONT_BODY};font-size:15px;font-weight:600;line-height:1;color:${C.sheet};text-decoration:none;">${escapeHtml(cta.label)} &rarr;</a>
    </td></tr></table>`;
}

// ---------------------------------------------------------------- Text

function renderText(c: EmailContent): string {
  const parts: string[] = [htmlToText(c.heading)];
  const cta = c.cta ? `${c.cta.label}: ${c.cta.href}` : null;
  for (const b of c.blocks) {
    switch (b.kind) {
      case "cta":
        if (cta) parts.push(cta);
        break;
      case "p":
      case "note":
        parts.push(htmlToText(`<p>${b.html}</p>`));
        break;
      case "code":
        parts.push(`${b.label ? `${b.label}:\n` : ""}    ${b.text}`);
        break;
      case "steps":
        parts.push(b.items.map((s, i) => `${i + 1}. ${s.title}\n   ${htmlToText(`<p>${s.html}</p>`)}`).join("\n\n"));
        break;
      case "facts":
        parts.push([...(b.title ? [b.title] : []), ...b.rows.map((r) => `- ${r.label}: ${r.value}`)].join("\n"));
        break;
    }
  }
  if (cta && !c.blocks.some((b) => b.kind === "cta")) parts.push(cta);
  parts.push(`— The ${DISPLAY_NAME} team`);
  parts.push(`${SITE_URL}\n${c.reason ?? DEFAULT_REASON}`);
  return parts.join("\n\n");
}
