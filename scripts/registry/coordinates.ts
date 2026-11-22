/**
 * Fills in coordinates for stations that have none (tasks 4.2).
 *
 *   pnpm registry:coordinates
 *
 * 1. Wikidata (CC0): reservoirs and dams in Czechia, matched by name; a reservoir entry wins
 *    over its dam entry.
 * 2. OpenStreetMap (ODbL, credit on the methodology page) for the rest: one Overpass query for
 *    every named reservoir and dam in Czechia, matched by name inside the station's basin.
 *
 * Only stations with lat/lon null are touched, so coordinates entered by hand ("manual") stay.
 * Stations it cannot place are listed; add them by hand with coordinateSource "manual".
 * Responses are cached in .cache/coordinates/.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CONTACT_EMAIL } from "../../src/scraper/config.ts";
import { StationsFileSchema, type Station } from "../../src/shared/registry.ts";

const FILE = "registry/stations.json";
const CACHE_DIR = ".cache/coordinates";
const USER_AGENT = `stavvody.cz-registry/0.1 (https://github.com/jamescoq/waterlevels; ${CONTACT_EMAIL})`;

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const RESERVOIR = "Q131681";
const DAM = "Q12323";

const STOP_WORDS = new Set([
  "vd",
  "vodni",
  "nadrz",
  "nadrze",
  "prehrada",
  "prehradni",
  "prehrady",
  "hraz",
  "dilo",
  "dila",
  "f",
  "m",
  "u",
  "na",
  "nad",
  "pod",
  "v",
  // "v. n." abbreviates "vodní nádrž".
  "n",
  "reservoir",
  "dam",
]);

/** Roman numerals in names ("Lipno II") match the portals' digits ("Lipno 2"). */
const ROMAN: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4" };

interface Candidate {
  source: string;
  label: string;
  lat: number;
  lon: number;
  isReservoir: boolean;
}

export function tokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP_WORDS.has(t))
    .map((t) => ROMAN[t] ?? t);
}

/** Same words, ignoring order, generic words ("vodní nádrž", "přehrada") and diacritics. */
export function sameName(a: string, b: string): boolean {
  const x = tokens(a).sort().join(" ");
  return x !== "" && x === tokens(b).sort().join(" ");
}

/** Rough check that a point lies on the right side of the country for its Povodí. */
export function plausibleForBasin(
  station: Pick<Station, "source">,
  lat: number,
  lon: number,
): boolean {
  const inCzechia = lat >= 48.55 && lat <= 51.06 && lon >= 12.09 && lon <= 18.86;
  if (!inCzechia) return false;
  switch (station.source) {
    case "pmo":
      return lon >= 15.2;
    case "pod":
      return lon >= 17.0 && lat >= 49.4;
    case "poh":
      return lon <= 14.6 && lat >= 49.9;
    case "pvl":
      // The Sázava catchment reaches east of Žďár nad Sázavou.
      return lon <= 16.1;
    case "pla":
      return lon >= 13.9 && lon <= 16.9 && lat >= 49.5;
  }
}

async function cached(key: string, load: () => Promise<string>): Promise<string> {
  const path = join(CACHE_DIR, key);
  const hit = await readFile(path, "utf8").catch(() => null);
  if (hit !== null) return hit;
  const body = await load();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
  return body;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function wikidataCandidates(): Promise<Candidate[]> {
  const query = `SELECT ?item ?label ?coord ?type WHERE {
    VALUES ?type { wd:${RESERVOIR} wd:${DAM} }
    ?item wdt:P17 wd:Q213 ; wdt:P31 ?type ; wdt:P625 ?coord ; rdfs:label ?label .
    FILTER(LANG(?label) = "cs") }`;
  const body = await cached("wikidata.json", () =>
    fetchText(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`),
  );
  const rows = JSON.parse(body).results.bindings as Record<string, { value: string }>[];
  return rows.flatMap((row) => {
    const point = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(row.coord!.value);
    if (!point) return [];
    return [
      {
        source: `wikidata:${row.item!.value.split("/").pop()}`,
        label: row.label!.value,
        lon: Number(point[1]),
        lat: Number(point[2]),
        isReservoir: row.type!.value.endsWith(RESERVOIR),
      },
    ];
  });
}

function pickWikidata(station: Station, candidates: Candidate[]): Candidate | "ambiguous" | null {
  const hits = candidates.filter((c) => sameName(c.label, station.name));
  const reservoirs = hits.filter((c) => c.isReservoir);
  const pool = reservoirs.length > 0 ? reservoirs : hits;
  const distinct = new Map(pool.map((c) => [c.source, c]));
  if (distinct.size === 1) return [...distinct.values()][0]!;
  return distinct.size > 1 ? "ambiguous" : null;
}

/**
 * Other names the reservoirs go by on maps, tried after the portal name. Every result still
 * has to pass the name and basin checks, so a wrong alias only means no match.
 */
const ALIASES: Record<string, string[]> = {
  "pmo-brno": ["Brněnská přehrada"],
  "pmo-luhacovice": ["Luhačovická přehrada"],
  // Nové Mlýny I, II and III are the upper, middle and lower basin.
  "pmo-nove-mlyny-horni-nadrz": ["Nové Mlýny I", "Nové Mlýny horní nádrž"],
  "pmo-nove-mlyny-stredni-nadrz": ["Nové Mlýny II", "Nové Mlýny-střed"],
  "pmo-nove-mlyny-dolni-nadrz": ["Nové Mlýny III", "Nové Mlýny dolní nádrž"],
  "pvl-svihov-zelivka": ["Švihov", "Želivka"],
  "pvl-lipno-1": ["Lipno"],
  "pvl-lipno-2": ["Lipno II"],
  "pvl-plzen-struncovy-sady": ["Štruncovy sady"],
};

/** Every word of the wanted name appears in the found name ("Přísečnice" in "Vodní nádrž Přísečnice"). */
export function containsName(found: string, wanted: string): boolean {
  const have = new Set(tokens(found));
  const want = tokens(wanted);
  return want.length > 0 && want.every((t) => have.has(t));
}

/** One Overpass query for every named reservoir and dam in and around Czechia. */
/** One Overpass query for every named reservoir and dam in and around Czechia. */
async function osmCandidates(): Promise<Candidate[]> {
  // A bounding box is far cheaper for Overpass than an area lookup; points across the border
  // are dropped by the basin check.
  const bbox = "48.55,12.09,51.06,18.86";
  const query = `[out:json][timeout:120];
    ( nwr["water"="reservoir"]["name"](${bbox});
      nwr["landuse"="reservoir"]["name"](${bbox});
      way["waterway"="dam"]["name"](${bbox}); );
    out center tags;`;
  const key = createHash("sha256").update(query).digest("hex").slice(0, 12);
  const body = await cached(`overpass-${key}.json`, async () => {
    // Public Overpass instances are often busy; try the next one on an error.
    let lastError: unknown;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "User-Agent": USER_AGENT,
            // overpass-api.de refuses requests without an Accept header (406).
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(240_000),
        });
        const text = response.ok ? await response.text() : "";
        // A query that ran out of time answers 200 with no elements and a remark; never cache it.
        if (response.ok && !/"remark":\s*"runtime error/.test(text)) return text;
        lastError = new Error(
          `${endpoint} returned ${response.status}${text ? " (query timed out)" : ""}`,
        );
      } catch (err) {
        lastError = err;
      }
      console.error(String(lastError));
    }
    throw lastError;
  });
  const elements = JSON.parse(body).elements as {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags: Record<string, string>;
  }[];
  return elements.flatMap((e) => {
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (lat === undefined || lon === undefined || !e.tags.name) return [];
    return [
      {
        source: `osm:${e.type}/${e.id}`,
        label: e.tags.name,
        lat,
        lon,
        isReservoir: e.tags.waterway !== "dam",
      },
    ];
  });
}

const distanceKm = (a: Candidate, b: Candidate) =>
  Math.hypot((a.lat - b.lat) * 111, (a.lon - b.lon) * 111 * Math.cos((a.lat * Math.PI) / 180));

function pickOsm(station: Station, candidates: Candidate[]): Candidate | "ambiguous" | null {
  const names = [station.name.replace(/\s+F-M$/, ""), ...(ALIASES[station.id] ?? [])];
  const exact = candidates.filter((c) => names.some((n) => sameName(c.label, n)));
  const hits =
    exact.length > 0
      ? exact
      : candidates.filter((c) => names.some((n) => containsName(c.label, n)));
  const inBasin = hits.filter((c) => plausibleForBasin(station, c.lat, c.lon));
  const reservoirs = inBasin.filter((c) => c.isReservoir);
  const pool = reservoirs.length > 0 ? reservoirs : inBasin;
  if (pool.length === 0) return null;
  // Several OSM objects for one reservoir (water area, landuse, parts) lie close together.
  const first = pool[0]!;
  return pool.every((c) => distanceKm(c, first) <= 3) ? first : "ambiguous";
}

async function main() {
  const file = StationsFileSchema.parse(JSON.parse(await readFile(FILE, "utf8")));
  const candidates = await wikidataCandidates();
  const osm = await osmCandidates().catch((err: unknown) => {
    console.error(`OpenStreetMap step skipped: ${String(err)}`);
    return [] as Candidate[];
  });
  const unresolved: string[] = [];
  const rejected: string[] = [];
  let placed = 0;

  for (const station of file.stations) {
    if (station.lat !== null) continue;
    const fromWikidata = pickWikidata(station, candidates);
    const fromOsm = fromWikidata && fromWikidata !== "ambiguous" ? null : pickOsm(station, osm);
    const found =
      fromWikidata && fromWikidata !== "ambiguous"
        ? fromWikidata
        : fromOsm && fromOsm !== "ambiguous"
          ? fromOsm
          : null;
    if (!found) {
      unresolved.push(
        `${station.id} (${station.name})${fromWikidata === "ambiguous" || fromOsm === "ambiguous" ? ": several possible matches" : ""}`,
      );
      continue;
    }
    if (!plausibleForBasin(station, found.lat, found.lon)) {
      rejected.push(
        `${station.id}: ${found.source} "${found.label}" at ${found.lat}, ${found.lon} is outside its basin`,
      );
      continue;
    }
    station.lat = Math.round(found.lat * 1e5) / 1e5;
    station.lon = Math.round(found.lon * 1e5) / 1e5;
    station.coordinateSource = found.source;
    placed++;
  }

  await writeFile(FILE, JSON.stringify(StationsFileSchema.parse(file), null, 2) + "\n");
  console.log(
    `placed ${placed}; still without coordinates: ${unresolved.length + rejected.length}`,
  );
  if (rejected.length) console.log(`\nRejected by the basin check:\n  ${rejected.join("\n  ")}`);
  if (unresolved.length) console.log(`\nNot found:\n  ${unresolved.join("\n  ")}`);
}

if (process.argv[1]?.endsWith("coordinates.ts")) await main();
