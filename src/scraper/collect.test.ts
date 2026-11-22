import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import { collect, type CollectOptions, type PageFetcher } from "./collect.ts";
import type { FetchResult } from "./http.ts";
import { SOURCES } from "./sources.ts";
import { StationsFileSchema, type StationsFile } from "../shared/registry.ts";

const root = join(import.meta.dirname, "../..");
const fixture = (path: string) => readFileSync(join(root, "test/fixtures", path), "utf8");
const registry = StationsFileSchema.parse(
  JSON.parse(readFileSync(join(root, "registry/stations.json"), "utf8")),
);

type Reply = { status: number | null; body?: string; error?: string };

/** Serves the saved portal pages; `overrides` replaces or scripts replies per URL. */
function fixtureFetcher(overrides: Record<string, Reply[]> = {}) {
  const requests: string[] = [];
  const fetcher: PageFetcher = {
    async get(url: string): Promise<FetchResult> {
      requests.push(url);
      const scripted = overrides[url]?.shift();
      const reply = scripted ?? defaultReply(url);
      return {
        url,
        finalUrl: url,
        status: reply.status,
        body: reply.body ?? "",
        error: reply.error ?? null,
        attempts: 1,
        durationMs: 0,
      };
    },
  };
  return { fetcher, requests };
}

function defaultReply(url: string): Reply {
  const source = SOURCES.find((s) => url.startsWith(new URL("/", s.baseUrl).href));
  if (!source) return { status: 404 };
  if (url.endsWith("/robots.txt")) return { status: 404 };
  if (url.endsWith("Prehled.aspx"))
    return { status: 200, body: fixture(`${source.code}/overview.html`) };
  if (url.endsWith("Objemy.aspx"))
    return { status: 200, body: fixture(`${source.code}/volumes.html`) };
  return { status: 404 };
}

const url = (code: string, file: string) => {
  const source = SOURCES.find((s) => s.code === code)!;
  return file === "robots.txt"
    ? new URL("/robots.txt", source.baseUrl).href
    : new URL(file, source.baseUrl).href;
};

const sleeps: number[] = [];
const run = (fetcher: PageFetcher, over: Partial<CollectOptions> = {}) =>
  collect({
    fetcher,
    registry,
    overrides: {},
    now: new Date("2026-11-22T09:39:00Z"),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    ...over,
  });

const registeredIn = (code: string, file: StationsFile = registry) =>
  file.stations.filter((s) => s.source === code).length;

describe("collect: a normal day", async () => {
  const { fetcher, requests } = fixtureFetcher();
  const result = await run(fetcher);
  if (!result.ok) throw new Error(result.reason);
  const { snapshot } = result;

  it("stores a snapshot for the Prague date with every reachable station", () => {
    expect(snapshot.date).toBe("2026-11-22");
    expect(snapshot.sources).toEqual({ pmo: "ok", pod: "ok", poh: "paused", pvl: "ok", pla: "ok" });
    const expected = ["pmo", "pod", "pvl", "pla"].reduce((n, c) => n + registeredIn(c), 0);
    expect(Object.keys(snapshot.stations)).toHaveLength(expected);
    expect(snapshot.unmatched).toEqual([]);
  });

  it("keeps to the request budget and never fetches a detail page (spec: Normal daily run)", () => {
    expect(requests.length).toBeLessThanOrEqual(15);
    expect(requests.filter((u) => u.includes("Mereni.aspx"))).toEqual([]);
  });

  it("sends no request to a paused source (spec: Daily run with Povodí Ohře paused)", () => {
    expect(requests.filter((u) => u.includes("sap.poh.cz"))).toEqual([]);
    expect(snapshot.sourceReasons.poh).toMatch(/Cloudflare/);
    expect(Object.keys(snapshot.stations).some((id) => id.startsWith("poh-"))).toBe(false);
  });

  it("stores every parsed value, including ones the site does not show (spec: Value not shown in v1)", () => {
    expect(snapshot.stations["pod-slezska-harta"]).toEqual({
      measuredAt: "2026-11-22T10:30:00+01:00",
      volumesMeasuredAt: "2026-11-22T10:30:00+01:00",
      level: 491.13,
      volume: 155.49,
      inflow: 4.54,
      outflow: 4.54,
      precipitation1h: null,
      precipitation24h: null,
      airTemperature: 3,
      floodThresholds: { Qa: 4.77, Q1: 46, Q5: 100, Q20: 158, Q100: 235 },
      purpose: "Víceúčelová",
      storage: expect.objectContaining({ filled: expect.any(Number), free: expect.any(Number) }),
      retentionControllable: expect.anything(),
      retentionUncontrollable: expect.anything(),
      note: "",
    });
  });

  it("does not report the ignored Dalešice duplicate as unmatched", () => {
    expect(snapshot.stations["pmo-dalesice"]?.level).toBe(374.23);
    expect(snapshot.warnings.filter((w) => w.includes("Dalešice"))).toEqual([]);
  });
});

describe("collect: problems with one source stay contained", () => {
  it("records an unreachable portal as failed and stores the rest (spec: One portal down)", async () => {
    const down: Reply = { status: null, error: "TypeError: fetch failed" };
    const { fetcher } = fixtureFetcher({ [url("pla", "Prehled.aspx")]: [down] });
    const result = await run(fetcher);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.sources.pla).toBe("failed");
    expect(result.snapshot.sources.pod).toBe("ok");
    expect(Object.keys(result.snapshot.stations).some((id) => id.startsWith("pla-"))).toBe(false);
  });

  it("records too few rows as partial and stores none of them (spec: Portal layout changed)", async () => {
    const $ = cheerio.load(fixture("pmo/overview.html"));
    $('a[href*="Mereni.aspx"]').slice(10).closest("tr").remove();
    const { fetcher } = fixtureFetcher({
      [url("pmo", "Prehled.aspx")]: [{ status: 200, body: $.html() }],
    });
    const result = await run(fetcher);
    if (!result.ok) throw new Error(result.reason);
    expect(result.snapshot.sources.pmo).toBe("partial");
    // 10 rows kept; one of them is the ignored Dalešice duplicate.
    expect(result.snapshot.sourceReasons.pmo).toMatch(/only 9 of 28/);
    expect(Object.keys(result.snapshot.stations).some((id) => id.startsWith("pmo-"))).toBe(false);
    expect(result.snapshot.sources.pvl).toBe("ok");
  });

  it("records a page the parser cannot read as partial", async () => {
    const broken = fixture("pod/overview.html").replace("Hladina vody v nádrži", "Hladina");
    const { fetcher } = fixtureFetcher({
      [url("pod", "Prehled.aspx")]: [{ status: 200, body: broken }],
    });
    const result = await run(fetcher);
    if (!result.ok) throw new Error(result.reason);
    expect(result.snapshot.sources.pod).toBe("partial");
    expect(result.snapshot.sourceReasons.pod).toMatch(/layout changed/);
  });

  it("does not fetch a page robots.txt disallows (spec: Page disallowed)", async () => {
    const robots: Reply = { status: 200, body: "User-agent: *\nDisallow: /portal/\n" };
    const { fetcher, requests } = fixtureFetcher({ [url("pod", "robots.txt")]: [robots] });
    const result = await run(fetcher);
    if (!result.ok) throw new Error(result.reason);
    expect(result.snapshot.sources.pod).toBe("blocked");
    expect(requests.filter((u) => u.includes("pod.cz/portal"))).toEqual([]);
  });

  it("fetches a page again after the 'načítám data' placeholder", async () => {
    sleeps.length = 0;
    const loading: Reply = { status: 200, body: fixture("pmo/overview-loading.html") };
    const { fetcher, requests } = fixtureFetcher({ [url("pmo", "Prehled.aspx")]: [loading] });
    const result = await run(fetcher);
    if (!result.ok) throw new Error(result.reason);
    expect(result.snapshot.sources.pmo).toBe("ok");
    expect(requests.filter((u) => u === url("pmo", "Prehled.aspx"))).toHaveLength(2);
    expect(sleeps).toEqual([30_000]);
  });

  it("gives up after two retries of the placeholder", async () => {
    const loading: Reply = { status: 200, body: fixture("pmo/overview-loading.html") };
    const { fetcher } = fixtureFetcher({
      [url("pmo", "Prehled.aspx")]: [loading, { ...loading }, { ...loading }],
    });
    const result = await run(fetcher);
    if (!result.ok) throw new Error(result.reason);
    expect(result.snapshot.sources.pmo).toBe("failed");
    expect(result.snapshot.sourceReasons.pmo).toMatch(/načítám data/);
  });
});

describe("collect: registry checks", () => {
  it("lists a station the registry does not know (spec: Station not in the registry)", async () => {
    const without = {
      ...registry,
      stations: registry.stations.filter((s) => s.id !== "pod-slezska-harta"),
    };
    const { fetcher } = fixtureFetcher();
    const result = await run(fetcher, { registry: without });
    if (!result.ok) throw new Error(result.reason);
    expect(result.snapshot.unmatched).toEqual([
      { source: "pod", portalId: { id: "300021251", oid: "1" }, name: "VD Slezská Harta" },
    ]);
    expect(result.snapshot.warnings).toContainEqual(
      expect.stringMatching(/unregistered station "VD Slezská Harta"/),
    );
    expect(result.snapshot.stations["pod-slezska-harta"]).toBeUndefined();
  });

  it("stores an implausible level as missing, with a warning", async () => {
    const lowCrest = {
      ...registry,
      stations: registry.stations.map((s) =>
        s.id === "pod-slezska-harta" ? { ...s, levels: { ...s.levels, crest: 480 } } : s,
      ),
    };
    const { fetcher } = fixtureFetcher();
    const result = await run(fetcher, { registry: lowCrest });
    if (!result.ok) throw new Error(result.reason);
    expect(result.snapshot.stations["pod-slezska-harta"]?.level).toBeNull();
    expect(result.snapshot.warnings).toContainEqual(
      expect.stringMatching(/pod-slezska-harta: level 491\.13/),
    );
  });
});

describe("collect: validation guards", () => {
  it("stores nothing when every source fails (spec: All portals unreachable)", async () => {
    const down: Reply = { status: null, error: "TypeError: fetch failed" };
    const replies = Object.fromEntries(
      SOURCES.map((s) => [new URL("/robots.txt", s.baseUrl).href, [down]]),
    );
    const { fetcher } = fixtureFetcher(replies);
    const result = await run(fetcher);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no source delivered usable data");
    expect(result.sources).toEqual({
      pmo: "failed",
      pod: "failed",
      poh: "paused",
      pvl: "failed",
      pla: "failed",
    });
  });
});
