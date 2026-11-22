/**
 * Hillshade background (design.md Decision 5): elevation shaded in the map's projection,
 * tinted in the design's blues, transparent outside Czechia.
 */
import sharp from "sharp";
import type { Dem } from "./sources.ts";
import { DESKTOP_MAP_WIDTH, type MapFrame } from "../../src/shared/projection.ts";

/** Relief is exaggerated so hills read at country scale. */
const Z_FACTOR = 2;
/** Sun from the north-west, 45° above the horizon. */
const AZIMUTH_DEG = 315;
const ALTITUDE_DEG = 45;

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;

/** Design palette (desktop mockup's relief gradient and land fill). */
const LOWLAND = hex("#0E2238");
const UPLAND = hex("#1D3D60");
const LIT = hex("#4674A3");
const SHADOW = hex("#071322");

function sample(dem: Dem, lon: number, lat: number): number {
  const fx = (lon - dem.west) * dem.perDegree - 0.5;
  const fy = (dem.north - lat) * dem.perDegree - 0.5;
  const x0 = Math.max(0, Math.min(dem.width - 2, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(dem.height - 2, Math.floor(fy)));
  const tx = Math.min(1, Math.max(0, fx - x0));
  const ty = Math.min(1, Math.max(0, fy - y0));
  const at = (x: number, y: number) => {
    const v = dem.data[y * dem.width + x]!;
    return Number.isNaN(v) ? 0 : v;
  };
  const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
  const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

/** Elevation grid in the frame's pixels. */
export function elevationGrid(
  dem: Dem,
  frame: MapFrame,
): { width: number; height: number; data: Float32Array } {
  const width = Math.round(frame.width);
  const height = Math.round(frame.height);
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const { lon, lat } = frame.unproject(x + 0.5, y + 0.5);
      data[y * width + x] = sample(dem, lon, lat);
    }
  }
  return { width, height, data };
}

/** Lambertian hillshade, 0 (shadow) … 1 (facing the sun); flat ground is cos(zenith). */
export function hillshade(
  grid: { width: number; height: number; data: Float32Array },
  metresPerPx: number,
) {
  const { width, height, data } = grid;
  const out = new Float32Array(width * height);
  const zenith = ((90 - ALTITUDE_DEG) * Math.PI) / 180;
  const azimuth = ((360 - AZIMUTH_DEG + 90) % 360) * (Math.PI / 180);
  const at = (x: number, y: number) =>
    data[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))]!;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Horn's method over the 3×3 neighbourhood.
      const a = at(x - 1, y - 1),
        b = at(x, y - 1),
        c = at(x + 1, y - 1);
      const d = at(x - 1, y),
        f = at(x + 1, y);
      const g = at(x - 1, y + 1),
        h = at(x, y + 1),
        i = at(x + 1, y + 1);
      const dzdx = (c + 2 * f + i - (a + 2 * d + g)) / (8 * metresPerPx);
      const dzdy = (g + 2 * h + i - (a + 2 * b + c)) / (8 * metresPerPx);
      const slope = Math.atan(Z_FACTOR * Math.hypot(dzdx, dzdy));
      const aspect = Math.atan2(dzdy, -dzdx);
      out[y * width + x] = Math.max(
        0,
        Math.cos(zenith) * Math.cos(slope) +
          Math.sin(zenith) * Math.sin(slope) * Math.cos(azimuth - aspect),
      );
    }
  }
  return out;
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb =>
  [0, 1, 2].map((k) => a[k]! + (b[k]! - a[k]!) * t) as Rgb;

/** Renders the tinted hillshade, masked to the border, as WebP. */
export async function renderHillshade(
  dem: Dem,
  frame: MapFrame,
  /** Border path in the 880 px desktop frame (geometry.json). */
  borderPath: string,
  borderHeight880: number,
): Promise<Buffer> {
  const grid = elevationGrid(dem, frame);
  const shade = hillshade(grid, frame.metresPerPx);
  const flat = Math.cos(((90 - ALTITUDE_DEG) * Math.PI) / 180);

  const { width, height } = grid;
  const mask = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${DESKTOP_MAP_WIDTH} ${borderHeight880}" preserveAspectRatio="none"><path d="${borderPath}" fill="#fff"/></svg>`,
    ),
  )
    .extractChannel(0)
    .raw()
    .toBuffer();

  const rgba = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const elevation = grid.data[p]!;
    const upland = Math.min(1, Math.max(0, (elevation - 250) / 1000));
    const base = mix(LOWLAND, UPLAND, Math.sqrt(upland));
    const light = (shade[p]! - flat) / (1 - flat); // -flat/(1-flat) … 1
    // Lowlands stay calm; shading grows with elevation so the mountains carry the relief.
    const strength = 0.35 + 0.65 * Math.sqrt(upland);
    const color =
      light >= 0
        ? mix(base, LIT, Math.min(1, light * 1.1 * strength))
        : mix(base, SHADOW, Math.min(1, -light * 1.3 * strength));
    rgba[p * 4] = Math.round(color[0]);
    rgba[p * 4 + 1] = Math.round(color[1]);
    rgba[p * 4 + 2] = Math.round(color[2]);
    rgba[p * 4 + 3] = mask[p]!;
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .webp({ quality: 76, alphaQuality: 80, effort: 6 })
    .toBuffer();
}
