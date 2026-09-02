import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import { checkHeadings } from "../../../src/crawler/checks/headings";
import { checkImages } from "../../../src/crawler/checks/images";
import { checkIndexability } from "../../../src/crawler/checks/indexability";
import { checkLinks } from "../../../src/crawler/checks/links";
import { checkMeta } from "../../../src/crawler/checks/meta";

describe("crawler checks", () => {
  describe("checkMeta", () => {
    it("flags a page missing title/description/canonical", () => {
      const $ = cheerio.load("<html><head></head><body></body></html>");
      const issues = checkMeta($);
      expect(issues.map((i) => i.type).sort()).toEqual(
        ["missing_canonical", "missing_meta_description", "missing_title"].sort()
      );
    });

    it("finds nothing wrong on a well-formed head", () => {
      const $ = cheerio.load(`
        <html><head>
          <title>Widgets — Example</title>
          <meta name="description" content="Buy widgets.">
          <link rel="canonical" href="https://example.com/widgets">
        </head><body></body></html>
      `);
      expect(checkMeta($)).toEqual([]);
    });
  });

  describe("checkHeadings", () => {
    it("flags zero h1s", () => {
      const $ = cheerio.load("<body><h2>Not an h1</h2></body>");
      expect(checkHeadings($)).toEqual([{ type: "missing_h1", detail: "no <h1> on the page" }]);
    });

    it("flags multiple h1s", () => {
      const $ = cheerio.load("<body><h1>One</h1><h1>Two</h1></body>");
      const issues = checkHeadings($);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.type).toBe("multiple_h1");
    });

    it("is happy with exactly one h1", () => {
      const $ = cheerio.load("<body><h1>Widgets</h1></body>");
      expect(checkHeadings($)).toEqual([]);
    });
  });

  describe("checkImages", () => {
    it("counts images missing alt text", () => {
      const $ = cheerio.load(`
        <body>
          <img src="a.png" alt="A widget">
          <img src="b.png">
          <img src="c.png" alt="">
        </body>
      `);
      const issues = checkImages($);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        type: "missing_alt_text",
        detail: "2 <img> element(s) missing alt text"
      });
    });
  });

  describe("checkIndexability", () => {
    it("flags noindex and non-2xx status together", () => {
      const $ = cheerio.load('<meta name="robots" content="noindex, nofollow">');
      const issues = checkIndexability($, 404);
      expect(issues.map((i) => i.type).sort()).toEqual(["noindex", "non_ok_status"]);
    });

    it("is quiet for an indexable 200 page", () => {
      const $ = cheerio.load("<html></html>");
      expect(checkIndexability($, 200)).toEqual([]);
    });
  });

  describe("checkLinks", () => {
    it("flags only links to pages confirmed broken, leaves unknown ones alone", () => {
      const statusByUrl = new Map([
        ["https://example.com/ok", 200],
        ["https://example.com/broken", 404]
      ]);
      const issues = checkLinks(
        ["https://example.com/ok", "https://example.com/broken", "https://example.com/unvisited"],
        statusByUrl
      );
      expect(issues).toEqual([
        { type: "broken_internal_link", detail: "https://example.com/broken -> HTTP 404" }
      ]);
    });
  });
});
