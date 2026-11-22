/**
 * Builds or refreshes registry/stations.json from the portals (tasks 4.1).
 *
 *   pnpm registry:build [--source pmo,pod] [--refresh]
 *
 * Fetches robots.txt, the overview and volumes pages, and the detail page of every station:
 * about 130 requests in total, 2 s apart per host. Run it by hand, from a network that can reach
 * all portals (Povodí Ohře blocks GitHub's runners), and only when stations or their levels
 * change. Pages are cached in .cache/registry/; pass --refresh to fetch them again.
 *
 * Kept from the existing file: each station's id, coordinates, hidden flag and purposes, and
 * the ignored rows. Refreshed from the portals: name, river, levels, height datum, purpose,
 * storage volume. Stations no longer listed on a portal are kept and reported.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { BOT_TOKEN } from "../../src/scraper/config.ts";
import { PoliteClient } from "../../src/scraper/http.ts";
import { parseDetail } from "../../src/scraper/portals/mge-detail.ts";
import { isLoadingPage, parseOverview, parseVolumes } from "../../src/scraper/portals/mge.ts";
import { policyFromResponse, type RobotsPolicy } from "../../src/scraper/robots.ts";
import { DAILY_PAGES, SOURCES, type Source } from "../../src/scraper/sources.ts";
import {
  StationsFileSchema,
  slugOf,
  type Station,
  type StationsFile,
} from "../../src/shared/registry.ts";

const FILE = "registry/stations.json";
/** Fetched pages are kept here, so a rerun after a fix sends no requests. Not committed. */
const CACHE_DIR = ".cache/registry";
const refresh = process.argv.includes("--refresh");
/** Extra attempts, 30 s apart, when a portal answers with its "loading data" placeholder. */
const LOADING_RETRIES = 2;

const PURPOSES: Record<string, Station["purposes"]> = {
  Vodárenská: ["drinking"],
};

const only = argValue("--source")?.split(",");
const sources = SOURCES.filter((s) => !only || only.includes(s.code));
const existing = StationsFileSchema.parse(JSON.parse(await readFile(FILE, "utf8")));
const client = new PoliteClient();

const portalKey = (source: string, id: string, oid: string) => `${source}/${id}/${oid}`;
const byPortal = new Map(
  existing.stations.map((s) => [portalKey(s.source, s.portalId.id, s.portalId.oid), s]),
);
const ignored = new Set(
  existing.ignoredRows.map((r) => portalKey(r.source, r.portalId.id, r.portalId.oid)),
);
const usedIds = new Set(existing.stations.map((s) => s.id));

const report: string[] = [];
const results = await Promise.all(sources.map(buildSource));
const fresh = new Map(
  results.flat().map((s) => [portalKey(s.source, s.portalId.id, s.portalId.oid), s]),
);

const missing = existing.stations.filter(
  (s) =>
    sources.some((src) => src.code === s.source) &&
    !fresh.has(portalKey(s.source, s.portalId.id, s.portalId.oid)),
);
for (const s of missing) report.push(`not listed on the portal any more, kept: ${s.id}`);

const stations = [
  ...existing.stations.filter(
    (s) => !fresh.has(portalKey(s.source, s.portalId.id, s.portalId.oid)),
  ),
  ...fresh.values(),
].sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name, "cs"));

const file: StationsFile = StationsFileSchema.parse({ ...existing, stations });
await writeFile(FILE, JSON.stringify(file, null, 2) + "\n");

console.log(report.join("\n"));
console.log(`\n${FILE}: ${file.stations.length} stations, ${file.ignoredRows.length} ignored rows`);

async function buildSource(source: Source): Promise<Station[]> {
  // robots.txt is only fetched when a page has to come from the portal.
  let robots: Promise<RobotsPolicy> | null = null;
  const policyLoader = () =>
    (robots ??= client
      .get(new URL("/robots.txt", source.baseUrl).href)
      .then((r) => policyFromResponse(r.status, r.body, BOT_TOKEN)));
  const policy = { isAllowed: (path: string) => policyLoader().then((p) => p.isAllowed(path)) };
  const page = async (file: string) => {
    const url = new URL(file, source.baseUrl);
    const cached = join(CACHE_DIR, source.code, file.replace(/[^A-Za-z0-9.=-]+/g, "_"));
    if (!refresh) {
      const hit = await readFile(cached, "utf8").catch(() => null);
      if (hit !== null) return hit;
    }
    if (!(await policy.isAllowed(url.pathname + url.search)))
      throw new Error(`${source.code}: ${file} disallowed by robots.txt`);
    for (let attempt = 1; ; attempt++) {
      const result = await client.get(url.href);
      if (result.status !== 200) {
        throw new Error(`${source.code}: ${file} returned ${result.status ?? result.error}`);
      }
      if (isLoadingPage(result.body)) {
        if (attempt === LOADING_RETRIES + 1)
          throw new Error(`${source.code}: ${file} kept showing "načítám data"`);
        console.error(`${source.code}: ${file} showed "načítám data", retrying in 30 s`);
        await new Promise((resolve) => setTimeout(resolve, 30_000));
        continue;
      }
      await mkdir(dirname(cached), { recursive: true });
      await writeFile(cached, result.body);
      return result.body;
    }
  };

  const overview = parseOverview(await page(DAILY_PAGES.overview));
  const volumes = parseVolumes(await page(DAILY_PAGES.volumes));
  if (overview.length === 0) throw new Error(`${source.code}: overview page has no station rows`);
  const volumeOf = new Map(volumes.map((v) => [`${v.portalId.id}/${v.portalId.oid}`, v]));

  const stations: Station[] = [];
  for (const row of overview) {
    const key = portalKey(source.code, row.portalId.id, row.portalId.oid);
    if (ignored.has(key)) continue;
    const detailFile = `Mereni.aspx?id=${encodeURIComponent(row.portalId.id)}&oid=${row.portalId.oid}`;
    const detail = parseDetail(await page(detailFile), row.name);
    const previous = byPortal.get(key);
    const storage = volumeOf.get(`${row.portalId.id}/${row.portalId.oid}`)?.storage;
    let capacity =
      storage && storage !== "undefined-zone" && storage.filled !== null && storage.free !== null
        ? round(storage.filled + storage.free, 3)
        : null;
    if (capacity === 0) {
      report.push(`storage zone reported as 0 + 0 mil. m³, capacity left unknown: ${row.name}`);
      capacity = null;
    }
    const portalPurpose = row.purpose ?? detail.purpose;

    const station: Station = {
      id: previous?.id ?? newId(source, row.name, row.portalId.id),
      kind: "reservoir",
      name: row.name,
      source: source.code,
      basin: source.basin,
      river: detail.river || row.river,
      portalId: row.portalId,
      sourceUrl: new URL(detailFile, source.baseUrl).href,
      lat: previous?.lat ?? null,
      lon: previous?.lon ?? null,
      coordinateSource: previous?.coordinateSource ?? null,
      levels: detail.levels,
      heightDatum: detail.heightDatum,
      storageVolume: capacity ?? previous?.storageVolume ?? null,
      portalPurpose,
      purposes: previous?.purposes.length
        ? previous.purposes
        : (PURPOSES[portalPurpose ?? ""] ?? []),
      hidden: previous?.hidden ?? false,
    };
    if (!previous) report.push(`new: ${station.id} (${station.name})`);
    else if (JSON.stringify(previous) !== JSON.stringify(station))
      report.push(`updated: ${station.id}`);
    stations.push(station);
  }
  console.error(`${source.code}: ${stations.length} stations`);
  return stations;
}

function newId(source: Source, name: string, portalId: string): string {
  let id = `${source.code}-${slugOf(name)}`;
  if (usedIds.has(id)) id = `${id}-${slugOf(portalId)}`;
  usedIds.add(id);
  return id;
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
