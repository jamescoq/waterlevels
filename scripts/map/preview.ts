/**
 * Composes the committed map assets with the station circles into one PNG for a visual check
 * (tasks 7.2): .cache/map-preview.png at 1760 px wide. Not a deliverable.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { MIN_DIAMETER_DESKTOP, layoutCircles } from "../../src/derive/circles.ts";
import type { MapGeometry } from "../../src/shared/geometry.ts";
import { DESKTOP_MAP_WIDTH, mapFrame } from "../../src/shared/projection.ts";
import { StationsFileSchema } from "../../src/shared/registry.ts";

const geometry = JSON.parse(await readFile("public/map/geometry.json", "utf8")) as MapGeometry;
const registry = StationsFileSchema.parse(
  JSON.parse(await readFile("registry/stations.json", "utf8")),
);
const circles = layoutCircles(
  registry.stations
    .filter((s) => s.lat !== null && s.lon !== null)
    .map((s) => ({ id: s.id, lon: s.lon!, lat: s.lat!, capacity: s.storageVolume })),
  mapFrame(DESKTOP_MAP_WIDTH),
  MIN_DIAMETER_DESKTOP,
);

const scale = 2;
const width = geometry.width * scale;
const height = Math.round(geometry.height * scale);
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${geometry.width} ${geometry.height}">
  <path d="${geometry.border}" fill="none" stroke="#7FA6D0" stroke-opacity="0.6" stroke-width="1"/>
  <path d="${geometry.rivers.feeder}" fill="none" stroke="#2F8FD6" stroke-opacity="0.7" stroke-width="0.6" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="${geometry.rivers.tributary}" fill="none" stroke="#3DA4E6" stroke-opacity="0.85" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="${geometry.rivers.main}" fill="none" stroke="#4FB3F0" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
  ${[...circles.values()].map((c) => `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="#3DB9F2" fill-opacity="0.35" stroke="#BDEBFF" stroke-width="0.8"/>`).join("")}
  ${geometry.cities.map((c) => `<circle cx="${c.x}" cy="${c.y}" r="2" fill="#E8F1FB"/><text x="${c.x + 4}" y="${c.y - 4}" font-family="sans-serif" font-size="9" fill="#A9BCD2">${escape(c.name)}</text>`).join("")}
</svg>`;

const background = { r: 7, g: 17, b: 31, alpha: 1 }; // map panel #07111F
await mkdir(".cache", { recursive: true });
const png = await sharp({ create: { width, height, channels: 4, background } })
  .composite([
    { input: await readFile("public/map/hillshade-1760.webp") },
    { input: Buffer.from(svg) },
  ])
  .png()
  .toBuffer();
await writeFile(".cache/map-preview.png", png);
console.log(`.cache/map-preview.png ${width}×${height}`);
