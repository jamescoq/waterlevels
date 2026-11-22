import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { containsName, plausibleForBasin, sameName } from "../scripts/registry/coordinates.ts";
import { SOURCES } from "../src/scraper/sources.ts";
import { OverridesFileSchema, StationsFileSchema } from "../src/shared/registry.ts";

const read = (file: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, "../registry", file), "utf8"));

// The committed registry files (tasks 4.1–4.4).
describe("registry/stations.json", () => {
  const file = StationsFileSchema.parse(read("stations.json"));

  it("validates against its schema", () => {
    expect(file.stations.length).toBeGreaterThan(100);
  });

  it("gives every station a portal id, a source URL and an explicit value for every level", () => {
    for (const s of file.stations) {
      expect(s.sourceUrl, s.id).toContain(
        `id=${encodeURIComponent(s.portalId.id)}&oid=${s.portalId.oid}`,
      );
      expect(Object.keys(s.levels).sort(), s.id).toEqual([
        "crest",
        "maxRetention",
        "permanent",
        "spillway",
        "storage",
      ]);
    }
  });

  it("uses each source's own basin and portal", () => {
    for (const s of file.stations) {
      const source = SOURCES.find((src) => src.code === s.source)!;
      expect(s.basin, s.id).toBe(source.basin);
      expect(s.sourceUrl.startsWith(source.baseUrl), s.id).toBe(true);
    }
  });

  it("places every station that has coordinates inside Czechia and its own basin", () => {
    for (const s of file.stations.filter((s) => s.lat !== null)) {
      expect(plausibleForBasin(s, s.lat!, s.lon!), `${s.id} at ${s.lat}, ${s.lon}`).toBe(true);
      expect(s.coordinateSource, s.id).toMatch(
        /^(wikidata:Q\d+|osm:(node|way|relation)\/\d+|manual)$/,
      );
    }
  });

  // Equal is allowed: Nové Mlýny's middle basin is held at its permanent level (170.00 m).
  it("keeps the storage level between the permanent pool and the crest", () => {
    // Published inconsistently on 2026-11-22 (storage 315 m, permanent pool 316 m); the station
    // also publishes no measurements.
    const known = new Set(["pvl-plzen-struncovy-sady"]);
    for (const s of file.stations.filter((s) => !known.has(s.id))) {
      const { crest, storage, permanent } = s.levels;
      if (storage !== null && permanent !== null)
        expect(storage, s.id).toBeGreaterThanOrEqual(permanent);
      if (storage !== null && crest !== null) expect(storage, s.id).toBeLessThan(crest);
    }
  });

  it("records purpose tags as a list on every station", () => {
    for (const s of file.stations) expect(Array.isArray(s.purposes), s.id).toBe(true);
  });
});

describe("registry/overrides.json", () => {
  it("validates against its schema and names only known stations", () => {
    const overrides = OverridesFileSchema.parse(read("overrides.json"));
    const ids = new Set(StationsFileSchema.parse(read("stations.json")).stations.map((s) => s.id));
    for (const id of Object.keys(overrides)) expect(ids.has(id), id).toBe(true);
  });
});

describe("coordinate matching helpers", () => {
  it("matches names regardless of generic words, order and diacritics", () => {
    expect(sameName("vodní nádrž Slezská Harta", "VD Slezská Harta")).toBe(true);
    expect(sameName("Přehradní hráz Šance", "VD Šance")).toBe(true);
    expect(sameName("Vodní nádrž Křižanovice II", "Křižanovice")).toBe(false);
  });

  it("accepts a found name that contains all words of the wanted one", () => {
    expect(containsName("Přísečnice - vodní nádrž", "VD Přísečnice")).toBe(true);
    expect(containsName("Nové Mlýny – horní nádrž", "VD Nové Mlýny - Horní nádrž")).toBe(true);
    expect(containsName("Hubenov", "VD Hubenov nádrž dolní")).toBe(false);
  });

  it("rejects points in the wrong part of the country", () => {
    // Slezská Harta (Odra) placed in Bohemia would be a mismatch.
    expect(plausibleForBasin({ source: "pod" }, 49.91, 17.51)).toBe(true);
    expect(plausibleForBasin({ source: "pod" }, 49.91, 14.5)).toBe(false);
    expect(plausibleForBasin({ source: "pvl" }, 52.5, 14.5)).toBe(false);
  });
});
