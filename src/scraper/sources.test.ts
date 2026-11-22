import { describe, expect, it } from "vitest";
import { SOURCES } from "./sources.ts";

describe("SOURCES", () => {
  it("lists the five Povodí once each", () => {
    expect(SOURCES.map((s) => s.code).sort()).toEqual(["pla", "pmo", "pod", "poh", "pvl"]);
  });

  it("pauses only Povodí Ohře, with a reason", () => {
    const paused = SOURCES.filter((s) => s.paused !== undefined);
    expect(paused.map((s) => s.code)).toEqual(["poh"]);
    expect(paused[0]?.paused).toMatch(/Cloudflare/);
  });

  it("uses HTTPS portal roots ending in a slash", () => {
    for (const s of SOURCES) expect(s.baseUrl).toMatch(/^https:\/\/[^/]+\/.+\/$/);
  });
});
