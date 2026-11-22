/**
 * Source data for the map assets, downloaded once and cached in .cache/map-sources/.
 *
 *   Natural Earth 1:10m (public domain): country border, cities
 *   OpenStreetMap via Overpass (ODbL): rivers, and the streams that feed registered reservoirs
 *   Copernicus DEM GLO-90 (Copernicus licence, attribution required): elevation
 *
 * Every download is plain data; nothing from it is executed.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fromUrl } from "geotiff";
import { CONTACT_EMAIL } from "../../src/scraper/config.ts";

export const CACHE = ".cache/map-sources";
const USER_AGENT = `stavvody.cz-map/0.1 (https://github.com/jamescoq/waterlevels; ${CONTACT_EMAIL})`;

/** Natural Earth release the vectors come from. */
export const NATURAL_EARTH_VERSION = "v5.1.2";

async function cached(key: string, load: () => Promise<Buffer | string>): Promise<Buffer> {
  const path = join(CACHE, key);
  const hit = await readFile(path).catch(() => null);
  if (hit) return hit;
  const body = await load();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
  return Buffer.from(body);
}

async function download(url: string, init: RequestInit = {}): Promise<string> {
  const response = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...init.headers },
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

export interface Feature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}

export async function naturalEarth(layer: string): Promise<{ features: Feature[] }> {
  const body = await cached(`natural-earth/${layer}.geojson`, () =>
    download(
      `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NATURAL_EARTH_VERSION}/geojson/${layer}.geojson`,
    ),
  );
  return JSON.parse(body.toString("utf8"));
}

export interface OsmWay {
  type: "way";
  id: number;
  tags: Record<string, string>;
  /** Nodes in OSM order; waterways point downstream. */
  geometry: { lat: number; lon: number }[];
}

async function overpass(key: string, query: string): Promise<OsmWay[]> {
  const body = await cached(`osm/${key}.json`, () =>
    download("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    }),
  );
  return (JSON.parse(body.toString("utf8")).elements as OsmWay[]).filter((e) => e.type === "way");
}

/** Every waterway=river in Czechia. */
export function osmRivers(): Promise<OsmWay[]> {
  return overpass(
    "rivers",
    `[out:json][timeout:300];
     area["ISO3166-1"="CZ"][admin_level=2]->.cz;
     way["waterway"="river"]["name"](area.cz);
     out tags geom;`,
  );
}

/** Streams and rivers with the given names, anywhere in Czechia. */
export function osmWaterwaysNamed(names: string[]): Promise<OsmWay[]> {
  const pattern = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const key = createHash("sha256").update(pattern).digest("hex").slice(0, 12);
  return overpass(
    `named-${key}`,
    `[out:json][timeout:300];
     area["ISO3166-1"="CZ"][admin_level=2]->.cz;
     way["waterway"~"^(river|stream|canal)$"]["name"~"^(${pattern})$"](area.cz);
     out tags geom;`,
  );
}

export interface Dem {
  west: number;
  north: number;
  /** Samples per degree. */
  perDegree: number;
  width: number;
  height: number;
  /** Elevation in metres, row-major from the north-west corner; NaN where unknown. */
  data: Float32Array;
}

/**
 * Copernicus GLO-90 for lat 48–51 and lon 12–19, at about 300 samples per degree (≈ 300 m),
 * read from the tiles' internal overviews so only a fraction of each file is downloaded.
 */
export async function demMosaic(): Promise<Dem> {
  const perDegree = 300;
  const [west, east, south, north] = [12, 19, 48, 51];
  const width = (east - west) * perDegree;
  const height = (north - south) * perDegree;
  const key = `dem/glo90-${west}-${east}-${south}-${north}-${perDegree}.f32`;

  const body = await cached(key, async () => {
    const data = new Float32Array(width * height).fill(Number.NaN);
    for (let lat = south; lat < north; lat++) {
      for (let lon = west; lon < east; lon++) {
        const name = `Copernicus_DSM_COG_30_N${String(lat).padStart(2, "0")}_00_E${String(lon).padStart(3, "0")}_00_DEM`;
        const tiff = await fromUrl(
          `https://copernicus-dem-90m.s3.amazonaws.com/${name}/${name}.tif`,
        );
        const raster = await tiff.readRasters({
          width: perDegree,
          height: perDegree,
          resampleMethod: "bilinear",
          interleave: true,
        });
        const values = raster as unknown as ArrayLike<number>;
        const x0 = (lon - west) * perDegree;
        const y0 = (north - lat - 1) * perDegree;
        for (let y = 0; y < perDegree; y++) {
          for (let x = 0; x < perDegree; x++) {
            data[(y0 + y) * width + x0 + x] = values[y * perDegree + x]!;
          }
        }
        console.error(`DEM tile N${lat} E${lon}`);
      }
    }
    return Buffer.from(data.buffer);
  });
  const data = new Float32Array(body.buffer, body.byteOffset, body.byteLength / 4);
  return { west, north, perDegree, width, height, data };
}
