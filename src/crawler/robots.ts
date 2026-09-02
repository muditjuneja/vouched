/**
 * Minimal robots.txt parser — honors `Disallow`/`Allow` prefix rules under
 * `User-agent: *` only (no wildcard/`$` matching, no crawl-delay, no
 * per-bot rules). Good enough to keep a self-audit polite; not a full
 * implementation of the spec.
 */
export interface RobotsRules {
  isAllowed(path: string): boolean;
}

interface Rule {
  prefix: string;
  allow: boolean;
}

function parseRobotsTxt(text: string): Rule[] {
  const rules: Rule[] = [];
  let inWildcardGroup = false;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.split("#")[0]!.trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      // A new user-agent line starts a new group; we only care about `*`.
      inWildcardGroup = value === "*";
      continue;
    }
    if (!inWildcardGroup) continue;

    if (key === "disallow" && value !== "") {
      rules.push({ prefix: value, allow: false });
    } else if (key === "allow" && value !== "") {
      rules.push({ prefix: value, allow: true });
    }
  }
  return rules;
}

export async function fetchRobotsRules(origin: string): Promise<RobotsRules> {
  let rules: Rule[] = [];
  try {
    const res = await fetch(new URL("/robots.txt", origin), {
      headers: { "user-agent": "mcp-seo-toolkit-audit/0.1" }
    });
    if (res.ok) {
      rules = parseRobotsTxt(await res.text());
    }
  } catch {
    // Unreachable robots.txt is treated as "no restrictions" — the crawl
    // still respects the page-count cap and identifies itself via UA.
  }

  return {
    isAllowed(path: string): boolean {
      // Longest matching prefix wins, per the (informal) robots.txt convention.
      let best: Rule | null = null;
      for (const rule of rules) {
        if (path.startsWith(rule.prefix) && (!best || rule.prefix.length > best.prefix.length)) {
          best = rule;
        }
      }
      return best ? best.allow : true;
    }
  };
}
