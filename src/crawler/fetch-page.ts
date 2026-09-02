import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

export interface FetchedPage {
  url: string;
  status: number;
  ok: boolean;
  contentType: string | null;
  /** Present only for a successful HTML response. */
  $?: CheerioAPI;
}

/**
 * Fetches one page for the crawler. Never throws — a network failure or
 * non-HTML response is a normal, reportable outcome (a broken/odd page),
 * not an exceptional one.
 */
export async function fetchPage(url: string): Promise<FetchedPage> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "mcp-seo-toolkit-audit/0.1" },
      redirect: "follow"
    });
    const contentType = res.headers.get("content-type");
    if (!res.ok || !contentType?.includes("text/html")) {
      // Drain the body so the connection can be reused, but don't parse it.
      await res.arrayBuffer().catch(() => undefined);
      return { url, status: res.status, ok: res.ok, contentType };
    }
    const html = await res.text();
    return { url, status: res.status, ok: true, contentType, $: cheerio.load(html) };
  } catch {
    return { url, status: 0, ok: false, contentType: null };
  }
}
