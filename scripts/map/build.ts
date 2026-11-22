/**
 * Builds the map assets (tasks 7.1–7.3):
 *
 *   pnpm map:build
 *
 *   public/map/geometry.json      border, rivers in three weights, cities (880 px frame)
 *   public/map/hillshade-880.webp  and  hillshade-1760.webp (for high-DPI screens)
 *
 * Downloads are cached in .cache/map-sources/, so a rerun uses no network and reproduces the
 * committed files. See scripts/map/README.md for sources, licences and credits.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { renderHillshade } from "./hillshade.ts";
import { demMosaic, naturalEarth, osmRivers, osmWaterwaysNamed } from "./sources.ts";
import { buildGeometry, riverName } from "./vectors.ts";
import { DESKTOP_MAP_WIDTH, mapFrame } from "../../src/shared/projection.ts";
import { StationsFileSchema } from "../../src/shared/registry.ts";

const OUT = "public/map";

const registry = StationsFileSchema.parse(
  JSON.parse(await readFile("registry/stations.json", "utf8")),
);
const frame = mapFrame(DESKTOP_MAP_WIDTH);

const feederNames = [...new Set(registry.stations.map((s) => riverName(s.river)))].sort();
const [countries, places, rivers, namedWaterways] = await Promise.all([
  naturalEarth("ne_10m_admin_0_countries"),
  naturalEarth("ne_10m_populated_places_simple"),
  osmRivers(),
  osmWaterwaysNamed(feederNames),
]);

const { geometry, report } = await buildGeometry({
  frame,
  countries,
  places,
  rivers,
  namedWaterways,
  stations: registry.stations,
});

await mkdir(OUT, { recursive: true });
const geometryJson = JSON.stringify(geometry);
await writeFile(`${OUT}/geometry.json`, geometryJson);

const dem = await demMosaic();
const sizes: string[] = [];
for (const width of [880, 1760]) {
  const webp = await renderHillshade(dem, mapFrame(width), geometry.border, geometry.height);
  await writeFile(`${OUT}/hillshade-${width}.webp`, webp);
  sizes.push(`hillshade-${width}.webp ${Math.round(webp.length / 1024)} KB`);
}

const kb = (n: number) => `${Math.round(n / 1024)} KB`;
console.log(
  [
    `geometry.json ${kb(geometryJson.length)} (${kb(gzipSync(geometryJson).length)} gzipped)`,
    ...sizes,
    `rivers: ${report.main.length} main, ${report.tributaries.length} tributaries, ${report.feeders.length} feeders, ${report.connectors.length} connectors`,
    `main: ${report.main.join(", ")}`,
    report.feedersNotFound.length
      ? `feeder streams not found near their reservoir: ${report.feedersNotFound.join(", ")}`
      : "every placed reservoir's stream found",
  ].join("\n"),
);
