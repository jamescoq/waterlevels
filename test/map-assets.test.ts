import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { OsmWay } from "../scripts/map/sources.ts";
import { MAIN_RIVER_KM, components, riverName, selectRivers } from "../scripts/map/vectors.ts";
import type { MapGeometry } from "../src/shared/geometry.ts";
import { DESKTOP_MAP_WIDTH, mapFrame } from "../src/shared/projection.ts";
import type { Station } from "../src/shared/registry.ts";

const root = join(import.meta.dirname, "..");
const asset = (file: string) => join(root, "public/map", file);

describe("committed map assets (tasks 7.1–7.3)", () => {
  const raw = readFileSync(asset("geometry.json"), "utf8");
  const geometry = JSON.parse(raw) as MapGeometry;
  const frame = mapFrame(DESKTOP_MAP_WIDTH);

  it("use the projection's 880 px frame", () => {
    expect(geometry.width).toBe(frame.width);
    expect(geometry.height).toBe(frame.height);
  });

  it("keep geometry.json under 150 KB gzipped", () => {
    expect(gzipSync(raw).length).toBeLessThan(150 * 1024);
  });

  it("contain a closed border and rivers of all three weights inside the frame", () => {
    expect(geometry.border).toMatch(/^M[\d. L]+Z/);
    for (const d of Object.values(geometry.rivers)) {
      expect(d.length).toBeGreaterThan(100);
      const numbers = d.match(/[\d.]+/g)!.map(Number);
      for (const [i, n] of numbers.entries()) {
        const limit = i % 2 === 0 ? geometry.width : geometry.height;
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(limit + 0.1);
      }
    }
  });

  it("place Praha, Brno and Ostrava where the projection puts them", () => {
    const city = (name: string) => geometry.cities.find((c) => c.name === name)!;
    const expected = {
      Praha: [14.42, 50.09],
      Brno: [16.61, 49.2],
      Ostrava: [18.28, 49.84],
    } as const;
    for (const [name, [lon, lat]] of Object.entries(expected)) {
      const p = frame.project(lon, lat);
      expect(Math.hypot(city(name).x - p.x, city(name).y - p.y), name).toBeLessThan(6);
    }
  });

  it.each([880, 1760])(
    "keep hillshade-%i.webp within 300 KB at the frame's size",
    async (width) => {
      const file = asset(`hillshade-${width}.webp`);
      expect(statSync(file).size).toBeLessThan(300 * 1024);
      const meta = await sharp(file).metadata();
      expect(meta.width).toBe(width);
      expect(meta.height).toBe(Math.round(mapFrame(width).height));
      expect(meta.hasAlpha).toBe(true);
    },
  );
});

// Synthetic rivers: a main river, a tributary flowing into it, and a feeder into the tributary.
const way = (id: number, name: string, points: [number, number][]): OsmWay => ({
  type: "way",
  id,
  tags: { name, waterway: "river" },
  geometry: points.map(([lon, lat]) => ({ lon, lat })),
});

/** A straight line of `km` kilometres eastwards along latitude 50. */
const eastwards = (fromLon: number, km: number): [number, number][] => [
  [fromLon, 50],
  [fromLon + km / 71.6, 50],
];

describe("river selection", () => {
  const main = way(1, "Hlavní", eastwards(14, MAIN_RIVER_KM + 10));
  const tributaryEnd: [number, number] = [14.5, 50];
  const tributary = way(2, "Přítok", [[14.5, 50.3], tributaryEnd]); // ~33 km, flows into the main river
  const feeder = way(3, "Potok", [
    [14.4, 50.35],
    [14.5, 50.3],
  ]); // flows into the tributary
  const elsewhere = way(4, "Potok", [
    [17, 49],
    [17.1, 49],
  ]); // a namesake far away
  const station = { id: "pvl-test", river: "Potok (PB)", lat: 50.34, lon: 14.41 } as Station;

  it("strips the portals' district codes from river names", () => {
    expect(riverName("Červený potok (BE)")).toBe("Červený potok");
    expect(riverName("Blanice (PI)")).toBe("Blanice");
    expect(riverName("Vltava")).toBe("Vltava");
  });

  it("keeps namesakes apart and finds each river's mouth", () => {
    const all = components([main, tributary, feeder, elsewhere]);
    expect(all.filter((c) => c.name === "Potok")).toHaveLength(2);
    expect(all.find((c) => c.name === "Přítok")!.mouths).toEqual([{ lon: 14.5, lat: 50 }]);
  });

  it("follows a reservoir's stream down to the main river (spec: tributaries meet their main river)", () => {
    const { chosen, report } = selectRivers(components([main, tributary, feeder, elsewhere]), [
      station,
    ]);
    const names = [...chosen.keys()]
      .map((c) => `${c.name}:${chosen.get(c)}:${c.ways[0]!.id}`)
      .sort();
    expect(names).toEqual(["Hlavní:1:1", "Potok:3:3", "Přítok:3:2"]);
    expect(report.connectors).toEqual(["Přítok"]);
    expect(report.feedersNotFound).toEqual([]);
  });

  it("reports a reservoir whose stream is not in the data", () => {
    const lost = { ...station, id: "pvl-lost", river: "Neznámý potok" } as Station;
    expect(selectRivers(components([main]), [lost]).report.feedersNotFound).toEqual([
      "pvl-lost (Neznámý potok)",
    ]);
  });
});
