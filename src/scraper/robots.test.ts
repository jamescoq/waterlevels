import { describe, expect, it } from "vitest";
import { parseRobots, policyFromResponse } from "./robots.ts";

const TOKEN = "stavvody.cz-bot";

describe("parseRobots", () => {
  it("allows everything when only named AI crawlers are blocked (Povodí Odry style)", () => {
    const policy = parseRobots("User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n", TOKEN);
    expect(policy.isAllowed("/portal/Nadrze/cz/pc/Prehled.aspx")).toBe(true);
  });

  it("applies the * group when there is no group for our token", () => {
    const policy = parseRobots("User-agent: *\nDisallow: /portal/\n", TOKEN);
    expect(policy.isAllowed("/portal/Nadrze/cz/pc/Prehled.aspx")).toBe(false);
    expect(policy.isAllowed("/index.html")).toBe(true);
  });

  it("prefers our own group over *", () => {
    const policy = parseRobots(
      "User-agent: *\nDisallow: /\n\nUser-agent: stavvody.cz-bot\nAllow: /portal/\nDisallow: /\n",
      TOKEN,
    );
    expect(policy.isAllowed("/portal/Nadrze/cz/pc/Objemy.aspx")).toBe(true);
    expect(policy.isAllowed("/admin")).toBe(false);
  });

  it("treats an empty Disallow as allow-all", () => {
    expect(parseRobots("User-agent: *\nDisallow:\n", TOKEN).isAllowed("/anything")).toBe(true);
  });

  it("uses the longest match, Allow winning a tie", () => {
    const policy = parseRobots(
      "User-agent: *\nDisallow: /portal/\nAllow: /portal/Nadrze/\nDisallow: /portal/Nadrze/cz/pc/Mereni\n",
      TOKEN,
    );
    expect(policy.isAllowed("/portal/Nadrze/cz/pc/Prehled.aspx")).toBe(true);
    expect(policy.isAllowed("/portal/Nadrze/cz/pc/Mereni.aspx?id=1&oid=1")).toBe(false);
    expect(policy.isAllowed("/portal/sap/")).toBe(false);
  });

  it("supports * and $ wildcards", () => {
    const policy = parseRobots("User-agent: *\nDisallow: /*.aspx$\n", TOKEN);
    expect(policy.isAllowed("/portal/Prehled.aspx")).toBe(false);
    expect(policy.isAllowed("/portal/Prehled.aspx?x=1")).toBe(true);
  });

  it("ignores comments and content-signal lines", () => {
    const policy = parseRobots(
      "# comment\nUser-agent: *\nContent-Signal: search=yes,ai-train=no\nAllow: /\n",
      TOKEN,
    );
    expect(policy.isAllowed("/portal/nadrze/cz/pc/Prehled.aspx")).toBe(true);
  });
});

describe("policyFromResponse", () => {
  it("allows everything when robots.txt is missing", () => {
    expect(policyFromResponse(404, "", TOKEN).isAllowed("/x")).toBe(true);
  });

  it("disallows everything on a server error or network failure", () => {
    expect(policyFromResponse(503, "", TOKEN).isAllowed("/x")).toBe(false);
    expect(policyFromResponse(null, "", TOKEN).isAllowed("/x")).toBe(false);
  });
});
