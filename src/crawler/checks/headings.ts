import type { CheerioAPI } from "cheerio";
import type { PageIssue } from "./types";

export function checkHeadings($: CheerioAPI): PageIssue[] {
  const issues: PageIssue[] = [];
  const h1Count = $("h1").length;

  if (h1Count === 0) {
    issues.push({ type: "missing_h1", detail: "no <h1> on the page" });
  } else if (h1Count > 1) {
    issues.push({ type: "multiple_h1", detail: `${h1Count} <h1> elements found` });
  }

  return issues;
}
