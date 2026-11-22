/**
 * The map's projection and frame (design.md Decision 5). Used at build time by the derive step
 * for station positions and by the map asset pipeline for border, rivers and hillshade, so they
 * all share one SVG coordinate space. The browser does no projection math.
 */
import proj4 from "proj4";

/** Lambert conformal conic fitted to Czechia. */
export const PROJECTION =
  "+proj=lcc +lat_1=49 +lat_2=50.5 +lat_0=49.8 +lon_0=15.5 +ellps=WGS84 +units=m +no_defs";

/** Geographic extent the map shows: Czechia plus a small margin. */
export const EXTENT = { west: 12.0, east: 18.95, south: 48.5, north: 51.1 } as const;

/** Map widths in CSS px that circle sizes and overlap handling are worked out for. */
export const DESKTOP_MAP_WIDTH = 880;
/** 390 px phone screen minus a 16 px gutter on each side. */
export const PHONE_MAP_WIDTH = 358;

const toMap = proj4("WGS84", PROJECTION);

export interface MapFrame {
  width: number;
  height: number;
  /** WGS84 → SVG px in this frame (y grows downwards). */
  project(lon: number, lat: number): { x: number; y: number };
  /** SVG px in this frame → WGS84. */
  unproject(x: number, y: number): { lon: number; lat: number };
  /** Ground distance of one px, in metres (true at the standard parallels). */
  metresPerPx: number;
}

let extent: { minX: number; maxX: number; minY: number; maxY: number } | null = null;

/** Projected bounds of EXTENT, sampled along its edges (they curve in a conic projection). */
function projectedExtent() {
  if (extent) return extent;
  const xs: number[] = [];
  const ys: number[] = [];
  const steps = 32;
  for (let i = 0; i <= steps; i++) {
    const lon = EXTENT.west + ((EXTENT.east - EXTENT.west) * i) / steps;
    const lat = EXTENT.south + ((EXTENT.north - EXTENT.south) * i) / steps;
    for (const [x, y] of [
      toMap.forward([lon, EXTENT.south]),
      toMap.forward([lon, EXTENT.north]),
      toMap.forward([EXTENT.west, lat]),
      toMap.forward([EXTENT.east, lat]),
    ] as [number, number][]) {
      xs.push(x);
      ys.push(y);
    }
  }
  extent = {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
  return extent;
}

export function mapFrame(width: number): MapFrame {
  const { minX, maxX, minY, maxY } = projectedExtent();
  const scale = width / (maxX - minX);
  return {
    width,
    height: Math.round((maxY - minY) * scale * 10) / 10,
    metresPerPx: 1 / scale,
    project(lon, lat) {
      const [x, y] = toMap.forward([lon, lat]) as [number, number];
      return { x: (x - minX) * scale, y: (maxY - y) * scale };
    },
    unproject(x, y) {
      const [lon, lat] = toMap.inverse([x / scale + minX, maxY - y / scale]) as [number, number];
      return { lon, lat };
    },
  };
}
