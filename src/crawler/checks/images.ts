import type { CheerioAPI } from "cheerio";
import type { PageIssue } from "./types";

export function checkImages($: CheerioAPI): PageIssue[] {
  const missing = $("img").filter((_, el) => {
    const alt = $(el).attr("alt");
    return alt === undefined || alt.trim() === "";
  }).length;

  if (missing === 0) return [];
  return [{ type: "missing_alt_text", detail: `${missing} <img> element(s) missing alt text` }];
}
