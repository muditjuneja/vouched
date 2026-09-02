import type { CheerioAPI } from "cheerio";
import type { PageIssue } from "./types";

export function checkIndexability($: CheerioAPI, status: number): PageIssue[] {
  const issues: PageIssue[] = [];

  const robotsMeta = $('meta[name="robots"]').attr("content")?.toLowerCase() ?? "";
  if (robotsMeta.includes("noindex")) {
    issues.push({ type: "noindex", detail: "meta robots contains noindex" });
  }

  if (status < 200 || status >= 300) {
    issues.push({ type: "non_ok_status", detail: `HTTP ${status}` });
  }

  return issues;
}
