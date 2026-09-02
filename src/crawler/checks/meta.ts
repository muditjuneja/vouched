import type { CheerioAPI } from "cheerio";
import type { PageIssue } from "./types";

export function checkMeta($: CheerioAPI): PageIssue[] {
  const issues: PageIssue[] = [];

  const title = $("title").first().text().trim();
  if (!title) {
    issues.push({ type: "missing_title", detail: "no <title> element (or it's empty)" });
  }

  const description = $('meta[name="description"]').attr("content")?.trim();
  if (!description) {
    issues.push({ type: "missing_meta_description", detail: "no meta description" });
  }

  const canonical = $('link[rel="canonical"]').attr("href")?.trim();
  if (!canonical) {
    issues.push({ type: "missing_canonical", detail: "no rel=canonical link" });
  }

  return issues;
}
