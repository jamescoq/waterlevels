import { describe, expect, it } from "vitest";
import { countVisit, visitUrl, type VisitEnvironment } from "./visits.ts";

const env = (over: Partial<VisitEnvironment> = {}): VisitEnvironment & { sent: string[] } => {
  const sent: string[] = [];
  return {
    counterHost: "stavvody.goatcounter.com",
    hostname: "stavvody.cz",
    search: "",
    referrer: "https://www.google.com/",
    title: "Stav nádrží – mapa ČR",
    screen: { width: 1440, height: 900, ratio: 2 },
    send: (url) => sent.push(url),
    ...over,
    sent,
  };
};

const params = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe("visit counting (visit-statistics spec)", () => {
  it("reports one visit for a page load on stavvody.cz (spec: Page load)", () => {
    const e = env();
    expect(countVisit(e)).toBe(true);
    expect(e.sent).toHaveLength(1);
    expect(e.sent[0]).toMatch(/^https:\/\/stavvody\.goatcounter\.com\/count\?/);
    expect(params(e.sent[0]!)).toMatchObject({
      p: "/",
      r: "https://www.google.com/",
      s: "1440,900,2",
      b: "0",
    });
  });

  it("records the station of a shared link (spec: Arriving through a shared link)", () => {
    const e = env({ search: "?stanice=pod-slezska-harta" });
    countVisit(e);
    expect(params(e.sent[0]!).p).toBe("/?stanice=pod-slezska-harta");
  });

  it("sends nothing in local development or from another host (spec: Production only)", () => {
    for (const hostname of [
      "localhost",
      "127.0.0.1",
      "jamescoq.github.io",
      "www.stavvody.cz.evil.example",
    ]) {
      const e = env({ hostname });
      expect(countVisit(e)).toBe(false);
      expect(e.sent).toEqual([]);
    }
  });

  it("sends nothing when no GoatCounter site is configured", () => {
    expect(visitUrl(env({ counterHost: undefined }))).toBeNull();
  });

  it("never throws when sending fails (spec: Counter blocked)", () => {
    const e = env({
      send: () => {
        throw new Error("blocked by client");
      },
    });
    expect(() => countVisit(e)).not.toThrow();
    expect(countVisit(e)).toBe(false);
  });
});
