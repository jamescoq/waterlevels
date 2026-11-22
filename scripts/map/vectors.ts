/**
 * Border, rivers and cities for the map, projected into the 880 px desktop frame
 * (station-map spec, "Map content"; design.md Decision 5).
 */
import mapshaper from "mapshaper";
import type { Feature, OsmWay } from "./sources.ts";
import type { Station } from "../../src/shared/registry.ts";
import type { MapGeometry, RiverWeight } from "../../src/shared/geometry.ts";
import type { MapFrame } from "../../src/shared/projection.ts";

export const MAIN_RIVER_KM = 150;
export const TRIBUTARY_KM = 40;
/** A feeder stream must pass within this distance of its reservoir. */
const FEEDER_SEARCH_KM = 8;
/** A river's mouth must lie this close to the river it flows into. */
const MOUTH_TOLERANCE_M = 250;
/** Two stretches of the same name belong to one river when their ends come this close. */
const JOIN_TOLERANCE_M = 300;
/** Pieces of a river at least this long are joined across a gap of up to BRIDGE_GAP_KM. */
const BRIDGE_MIN_PIECE_KM = 5;
const BRIDGE_GAP_KM = 15;

/** Czech names for the Natural Earth cities, which carry English or ASCII names. */
const CITY_NAMES: Record<string, string> = {
  Prague: "Praha",
  Ostrava: "Ostrava",
  Brno: "Brno",
  Pizen: "Plzeň",
  Zlín: "Zlín",
  Pardubice: "Pardubice",
  Liberec: "Liberec",
  Olomouc: "Olomouc",
  "České Budějovice": "České Budějovice",
  "Hradec Králové": "Hradec Králové",
  "Usti Nad Labem": "Ústí nad Labem",
  Jihlava: "Jihlava",
};

type Point = [number, number];

/** Connected ways of one name: one physical river. */
interface Component {
  name: string;
  ways: OsmWay[];
  km: number;
  /** Downstream ends: way ends that start no other way of this component. */
  mouths: { lat: number; lon: number }[];
}

export interface BuildGeometryInput {
  frame: MapFrame;
  countries: { features: Feature[] };
  places: { features: Feature[] };
  rivers: OsmWay[];
  namedWaterways: OsmWay[];
  stations: Station[];
}

export interface RiverReport {
  main: string[];
  tributaries: string[];
  feeders: string[];
  connectors: string[];
  feedersNotFound: string[];
}

/** "Červený potok (BE)" → "Červený potok": the portals append a district code. */
export const riverName = (name: string) => name.replace(/\s*\([A-ZÁ-Ž]{1,3}\)$/u, "").trim();

const nodeKey = (p: { lat: number; lon: number }) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const wayKm = (w: OsmWay) =>
  w.geometry.slice(1).reduce((s, p, i) => s + haversineKm(w.geometry[i]!, p), 0);

/** Shortest distance from an end of one piece to an end of the other, in km. */
function gapKm(group: OsmWay[], find: (i: number) => number, a: number, b: number): number {
  const ends = (root: number) =>
    group.flatMap((w, i) => (find(i) === root ? [w.geometry[0]!, w.geometry.at(-1)!] : []));
  const enA = ends(a);
  const enB = ends(b);
  let best = Infinity;
  for (const p of enA) for (const q of enB) best = Math.min(best, haversineKm(p, q));
  return best;
}

/** Groups ways of the same name into components: one per physical river. */
export function components(ways: OsmWay[]): Component[] {
  const byName = new Map<string, OsmWay[]>();
  const seen = new Set<number>();
  for (const way of ways) {
    if (seen.has(way.id) || way.geometry.length < 2 || !way.tags.name) continue;
    seen.add(way.id);
    byName.set(way.tags.name, [...(byName.get(way.tags.name) ?? []), way]);
  }

  const result: Component[] = [];
  for (const [name, group] of byName) {
    const parent = group.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
    // Stretches of one river do not always share end nodes: one may join the middle of the next,
    // or break at a weir. Join them when an end lies close to any node of the other.
    group.forEach((way, i) => {
      for (const end of [way.geometry[0]!, way.geometry.at(-1)!]) {
        group.forEach((other, j) => {
          if (i === j || find(i) === find(j)) return;
          if (other.geometry.some((p) => haversineKm(end, p) * 1000 <= JOIN_TOLERANCE_M)) {
            parent[find(i)] = find(j);
          }
        });
      }
    });
    // Second pass: bridge larger gaps (a reservoir, a stretch along or across the border)
    // between substantial pieces of the same river.
    const lengthOf = (root: number) =>
      group.reduce((km, w, i) => (find(i) === root ? km + wayKm(w) : km), 0);
    const roots = () => [...new Set(group.map((_, i) => find(i)))];
    for (let merged = true; merged;) {
      merged = false;
      const big = roots().filter((r) => lengthOf(r) >= BRIDGE_MIN_PIECE_KM);
      outer: for (const a of big) {
        for (const b of big) {
          if (a === b || find(a) !== a || find(b) !== b) continue;
          if (gapKm(group, find, a, b) <= BRIDGE_GAP_KM) {
            parent[b] = a;
            merged = true;
            break outer;
          }
        }
      }
    }

    const sets = new Map<number, OsmWay[]>();
    group.forEach((way, i) => sets.set(find(i), [...(sets.get(find(i)) ?? []), way]));
    for (const set of sets.values()) {
      const starts = new Set(set.map((w) => nodeKey(w.geometry[0]!)));
      result.push({
        name,
        ways: set,
        km: set.reduce((sum, w) => sum + wayKm(w), 0),
        mouths: set.map((w) => w.geometry.at(-1)!).filter((end) => !starts.has(nodeKey(end))),
      });
    }
  }
  return result;
}

/** Picks the rivers to draw and their weights, keeping every one connected downstream. */
export function selectRivers(
  all: Component[],
  stations: Station[],
): { chosen: Map<Component, RiverWeight>; report: RiverReport } {
  const chosen = new Map<Component, RiverWeight>();
  const report: RiverReport = {
    main: [],
    tributaries: [],
    feeders: [],
    connectors: [],
    feedersNotFound: [],
  };

  for (const c of all) {
    if (c.km >= MAIN_RIVER_KM) chosen.set(c, 1);
    else if (c.km >= TRIBUTARY_KM) chosen.set(c, 2);
  }

  for (const station of stations) {
    if (station.lat === null || station.lon === null) continue;
    const name = riverName(station.river);
    const here = { lat: station.lat, lon: station.lon };
    let best: { c: Component; km: number } | null = null;
    for (const c of all.filter((c) => c.name === name)) {
      for (const way of c.ways) {
        for (const p of way.geometry) {
          const km = haversineKm(here, p);
          if (km <= FEEDER_SEARCH_KM && (!best || km < best.km)) best = { c, km };
        }
      }
    }
    if (best && !chosen.has(best.c)) chosen.set(best.c, 3);
    if (!best) report.feedersNotFound.push(`${station.id} (${name})`);
  }

  // Follow every chosen river downstream until it reaches a chosen one or leaves the data.
  const queue = [...chosen.keys()];
  while (queue.length > 0) {
    const c = queue.shift()!;
    for (const mouth of c.mouths) {
      const receiver = receivingComponent(all, c, mouth);
      if (receiver && !chosen.has(receiver)) {
        chosen.set(receiver, receiver.km >= TRIBUTARY_KM ? 2 : 3);
        report.connectors.push(receiver.name);
        queue.push(receiver);
      }
    }
  }

  for (const [c, w] of chosen) {
    const list = w === 1 ? report.main : w === 2 ? report.tributaries : report.feeders;
    if (!report.connectors.includes(c.name) || w !== 3) list.push(c.name);
  }
  for (const list of Object.values(report))
    list.sort((a: string, b: string) => a.localeCompare(b, "cs"));
  return { chosen, report };
}

function receivingComponent(
  all: Component[],
  from: Component,
  mouth: { lat: number; lon: number },
) {
  let best: { c: Component; km: number } | null = null;
  for (const c of all) {
    if (c === from) continue;
    for (const way of c.ways) {
      for (const p of way.geometry) {
        const km = haversineKm(mouth, p);
        if (
          km * 1000 <= MOUTH_TOLERANCE_M &&
          (!best || km < best.km || (km === best.km && c.km > best.c.km))
        ) {
          best = { c, km };
        }
      }
    }
  }
  return best?.c ?? null;
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

function toPath(lines: Point[][]): string {
  return lines
    .filter((line) => line.length > 1)
    .map((line) => `M${line.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L")}`)
    .join("");
}

export async function buildGeometry(
  input: BuildGeometryInput,
): Promise<{ geometry: MapGeometry; report: RiverReport }> {
  const { frame } = input;
  const project = ([lon, lat]: number[]): Point => {
    const p = frame.project(lon!, lat!);
    return [p.x, p.y];
  };

  const czech = input.countries.features.find((f) => f.properties.ADM0_A3 === "CZE");
  if (!czech?.geometry) throw new Error("Natural Earth has no Czechia");
  const rings = (czech.geometry.coordinates as number[][][]).map((ring) => ring.map(project));
  const border = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: rings },
  };

  const { chosen, report } = selectRivers(
    components([...input.rivers, ...input.namedWaterways]),
    input.stations,
  );
  const riverFeatures = [...chosen].flatMap(([c, w]) =>
    c.ways.map((way) => ({
      type: "Feature",
      properties: { w },
      geometry: {
        type: "LineString",
        coordinates: way.geometry.map((p) => project([p.lon, p.lat])),
      },
    })),
  );

  // Planar coordinates (px): clip rivers to the border and simplify both.
  const files = {
    "border.json": { type: "FeatureCollection", features: [border] },
    "rivers.json": { type: "FeatureCollection", features: riverFeatures },
  };
  const out = await mapshaper.applyCommands(
    [
      "-i border.json rivers.json combine-files",
      "-clip target=rivers border",
      "-simplify interval=0.35 keep-shapes target=*",
      "-o format=geojson geojson-type=FeatureCollection precision=0.1 target=*",
    ].join(" "),
    files,
  );
  const read = (name: string) =>
    JSON.parse(String(out[name])) as {
      features: {
        properties: { w?: RiverWeight };
        geometry: { type: string; coordinates: unknown } | null;
      }[];
    };

  const borderOut = read("border.json").features[0]!.geometry!;
  const borderRings = (
    borderOut.type === "Polygon" ? [borderOut.coordinates] : borderOut.coordinates
  ) as Point[][][];

  const byWeight: Record<RiverWeight, Point[][]> = { 1: [], 2: [], 3: [] };
  for (const f of read("rivers.json").features) {
    if (!f.geometry || !f.properties.w) continue;
    const lines =
      f.geometry.type === "LineString"
        ? [f.geometry.coordinates as Point[]]
        : (f.geometry.coordinates as Point[][]);
    byWeight[f.properties.w].push(...lines);
  }

  const cities = input.places.features
    .filter((f) => f.properties.adm0_a3 === "CZE" && f.geometry?.type === "Point")
    .map((f) => {
      const [x, y] = project(f.geometry!.coordinates as number[]);
      const name = String(f.properties.name);
      return {
        name: CITY_NAMES[name] ?? name,
        x: Number(fmt(x)),
        y: Number(fmt(y)),
        population: Number(f.properties.pop_max),
      };
    })
    .sort((a, b) => b.population - a.population);

  return {
    geometry: {
      schemaVersion: 1,
      width: frame.width,
      height: frame.height,
      border: borderRings.map((polygon) => toPath(polygon) + "Z").join(""),
      rivers: {
        main: toPath(byWeight[1]),
        tributary: toPath(byWeight[2]),
        feeder: toPath(byWeight[3]),
      },
      cities: cities.map(({ name, x, y }) => ({ name, x, y })),
    },
    report,
  };
}
