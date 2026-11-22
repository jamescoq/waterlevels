import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import { buildLatest } from "./latest.ts";
import { collect, type PageFetcher } from "../scraper/collect.ts";
import { loadRegistry } from "../scraper/output.ts";
import { SOURCES } from "../scraper/sources.ts";
import type { OverridesFile, StationsFile } from "../shared/registry.ts";
import type { Snapshot } from "../shared/snapshot.ts";

const root = join(import.meta.dirname, "../..");
const now = new Date("2026-11-22T11:00:00+01:00");

const fixtures: PageFetcher = {
  async get(url) {
    const source = SOURCES.find((s) => url.startsWith(new URL("/", s.baseUrl).href))!;
    const page = url.endsWith("Prehled.aspx")
      ? "overview"
      : url.endsWith("Objemy.aspx")
        ? "volumes"
        : null;
    const body = page
      ? await readFile(join(root, "test/fixtures", source.code, `${page}.html`), "utf8")
      : "";
    return {
      url,
      finalUrl: url,
      status: page ? 200 : 404,
      body,
      error: null,
      attempts: 1,
      durationMs: 0,
    };
  },
};

let registry: StationsFile;
let overrides: OverridesFile;
let today: Snapshot;

/** The same day shifted 24 h back, with one level changed. */
function dayBefore(snapshot: Snapshot, levelDelta: Record<string, number> = {}): Snapshot {
  const shift = (iso: string | null) =>
    iso === null
      ? null
      : new Date(Date.parse(iso) - 24 * 3600_000).toISOString().replace(".000Z", "+00:00");
  return {
    ...snapshot,
    date: "2026-11-21",
    fetchedAt: new Date(Date.parse(snapshot.fetchedAt) - 24 * 3600_000).toISOString(),
    stations: Object.fromEntries(
      Object.entries(snapshot.stations).map(([id, s]) => [
        id,
        {
          ...s,
          measuredAt: shift(s.measuredAt),
          level: s.level === null ? null : s.level - (levelDelta[id] ?? 0),
        },
      ]),
    ),
  };
}

beforeAll(async () => {
  ({ registry, overrides } = await loadRegistry(join(root, "registry")));
  const result = await collect({
    fetcher: fixtures,
    registry,
    overrides,
    now,
    sleep: async () => {},
  });
  if (!result.ok) throw new Error(result.reason);
  today = result.snapshot;
});

const station = (latest: ReturnType<typeof buildLatest>, id: string) => {
  const s = latest.stations.find((x) => x.id === id);
  if (!s) throw new Error(`no ${id}`);
  return s;
};

describe("buildLatest", () => {
  it("derives statuses from the day's values", () => {
    const latest = buildLatest({ registry, overrides, snapshots: [today], now });
    expect(station(latest, "pod-kruzberk")).toMatchObject({ buildStatus: "high", fillPct: 92.06 });
    expect(station(latest, "pvl-lipno-1")).toMatchObject({ buildStatus: "medium", fillPct: 46.53 });
    expect(station(latest, "pvl-bilsko")).toMatchObject({
      buildStatus: "level-only",
      levelOnlyReason: "fill-not-published",
    });
    expect(station(latest, "pod-slezska-harta")).toMatchObject({
      sourceName: "Povodí Odry",
      storageFilled: 147.92,
      storageCapacity: 186.23,
      level: 491.13,
      outflow: 4.54,
      isLastKnown: false,
    });
  });

  it("shows a paused source's stations as Bez dat without values (spec: Source paused)", () => {
    const latest = buildLatest({ registry, overrides, snapshots: [today], now });
    expect(station(latest, "poh-flaje")).toMatchObject({
      buildStatus: "no-data",
      sourceStatus: "paused",
      isLastKnown: false,
      level: null,
    });
  });

  it("keeps last known values when a source fails (spec: Source failed)", () => {
    const failedToday: Snapshot = {
      ...today,
      sources: { ...today.sources, pla: "failed" },
      stations: Object.fromEntries(
        Object.entries(today.stations).filter(([id]) => !id.startsWith("pla-")),
      ),
    };
    const latest = buildLatest({
      registry,
      overrides,
      snapshots: [dayBefore(today), failedToday],
      now,
    });
    const bedrichov = station(latest, "pla-bedrichov");
    expect(bedrichov).toMatchObject({
      buildStatus: "no-data",
      sourceStatus: "failed",
      isLastKnown: true,
    });
    expect(bedrichov.level).toBe(773.64);
    expect(bedrichov.measuredAt).toBe("2026-11-21T09:20:00+00:00");
    expect(bedrichov.changeCm).toBeNull();
  });

  it("computes the change since yesterday", () => {
    const latest = buildLatest({
      registry,
      overrides,
      snapshots: [dayBefore(today, { "pod-slezska-harta": 0.05 }), today],
      now,
    });
    expect(station(latest, "pod-slezska-harta").changeCm).toBe(5);
    expect(station(latest, "pod-kruzberk").changeCm).toBe(0);
    expect(
      buildLatest({ registry, overrides, snapshots: [today], now }).stations[0]!.changeCm,
    ).toBeNull();
  });

  it("applies an active planned drawdown with its reason", () => {
    const latest = buildLatest({
      registry,
      overrides: {
        "pvl-lipno-1": { status: "planned", reason: "Oprava hráze", until: "2026-12-31" },
      },
      snapshots: [today],
      now,
    });
    expect(station(latest, "pvl-lipno-1")).toMatchObject({
      buildStatus: "planned",
      overrideReason: "Oprava hráze",
    });
  });

  it("leaves out hidden stations", () => {
    const hidden = {
      ...registry,
      stations: registry.stations.map((s) => (s.id === "pvl-jince" ? { ...s, hidden: true } : s)),
    };
    const latest = buildLatest({ registry: hidden, overrides, snapshots: [today], now });
    expect(latest.stations.some((s) => s.id === "pvl-jince")).toBe(false);
  });

  it("works before the first collection, with every station Bez dat", () => {
    const latest = buildLatest({ registry, overrides, snapshots: [], now });
    expect(latest.lastSuccessfulFetch).toBeNull();
    expect(new Set(latest.stations.map((s) => s.buildStatus))).toEqual(new Set(["no-data"]));
  });

  it("orders larger circles first and places every station with coordinates", () => {
    const latest = buildLatest({ registry, overrides, snapshots: [today], now });
    const radii = latest.stations.map((s) => s.desktop?.r ?? 0);
    expect(radii).toEqual([...radii].sort((a, b) => b - a));
    const withCoordinates = registry.stations.filter((s) => s.lat !== null).length;
    expect(latest.stations.filter((s) => s.desktop !== null)).toHaveLength(withCoordinates);
    expect(latest.map.desktop.width).toBe(880);
  });

  it("stays under 50 KB gzipped", () => {
    const latest = buildLatest({ registry, overrides, snapshots: [dayBefore(today), today], now });
    expect(gzipSync(JSON.stringify(latest)).length).toBeLessThan(50 * 1024);
  });
});
