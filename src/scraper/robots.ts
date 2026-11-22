/**
 * Minimal robots.txt support (RFC 9309): pick the group for our product token, falling back to
 * `*`, then apply the longest matching Allow/Disallow rule. Wildcards `*` and `$` are supported.
 */

interface Rule {
  allow: boolean;
  pattern: string;
}

export interface RobotsPolicy {
  /** Whether the given path (with query string) may be fetched. */
  isAllowed(path: string): boolean;
  /** Human-readable reason, for probe reports. */
  readonly summary: string;
}

export const allowAll = (summary: string): RobotsPolicy => ({ isAllowed: () => true, summary });
export const disallowAll = (summary: string): RobotsPolicy => ({ isAllowed: () => false, summary });

/**
 * Policy for a robots.txt fetch result. Following RFC 9309: a 4xx response means no rules, a 5xx
 * or network error means everything is disallowed until robots.txt can be read.
 */
export function policyFromResponse(
  status: number | null,
  body: string,
  productToken: string,
): RobotsPolicy {
  if (status === null) return disallowAll("robots.txt unreachable: treating site as disallowed");
  if (status >= 500)
    return disallowAll(`robots.txt returned ${status}: treating site as disallowed`);
  if (status >= 400) return allowAll(`robots.txt returned ${status}: no rules`);
  return parseRobots(body, productToken);
}

export function parseRobots(text: string, productToken: string): RobotsPolicy {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1]!.toLowerCase();
    const value = match[2]!.trim();

    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      // An empty Disallow allows everything and adds no rule.
      if (value === "") continue;
      current.rules.push({ allow: key === "allow", pattern: value });
    }
  }

  const token = productToken.toLowerCase();
  const own = groups.filter((g) => g.agents.includes(token));
  const chosen = own.length > 0 ? own : groups.filter((g) => g.agents.includes("*"));
  const rules = chosen.flatMap((g) => g.rules);
  const via =
    own.length > 0
      ? `group for ${productToken}`
      : chosen.length > 0
        ? "group for *"
        : "no matching group";

  return {
    summary:
      rules.length === 0 ? `allowed (${via}, no rules)` : `${rules.length} rule(s) from ${via}`,
    isAllowed(path: string): boolean {
      let best: Rule | null = null;
      for (const rule of rules) {
        if (!matches(rule.pattern, path)) continue;
        if (
          !best ||
          rule.pattern.length > best.pattern.length ||
          (rule.pattern.length === best.pattern.length && rule.allow && !best.allow)
        ) {
          best = rule;
        }
      }
      return best ? best.allow : true;
    },
  };
}

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${regex}${anchored ? "$" : ""}`).test(path);
}
