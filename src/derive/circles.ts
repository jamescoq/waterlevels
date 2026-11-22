/**
 * Circle size and overlap handling (station-map spec, "Circle size" and "Overlap handling").
 */
import { DESKTOP_MAP_WIDTH, type MapFrame } from "../shared/projection.ts";

export const MIN_DIAMETER_DESKTOP = 18;
export const MIN_DIAMETER_PHONE = 10;
export const GAP_PX = 3;
export const MAX_SHIFT_PX = 16;

/** 10 + 2.45 × √(capacity in mil. m³) px at an 880 px map, scaled, never below the minimum. */
export function circleDiameter(
  capacity: number | null,
  mapWidth: number,
  minDiameter: number,
): number {
  if (capacity === null || capacity <= 0) return minDiameter;
  const at880 = 10 + 2.45 * Math.sqrt(capacity);
  return Math.max(minDiameter, (at880 * mapWidth) / DESKTOP_MAP_WIDTH);
}

export interface CircleInput {
  id: string;
  lon: number;
  lat: number;
  capacity: number | null;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/**
 * Places circles at their true positions, then pushes overlapping ones apart, aiming for a
 * GAP_PX gap. No circle ever ends up more than MAX_SHIFT_PX from its true position; where a
 * cluster cannot be separated within that, circles stay overlapping (the smaller is drawn on
 * top). Deterministic: the same input always gives the same layout.
 */
export function layoutCircles(
  inputs: CircleInput[],
  frame: MapFrame,
  minDiameter: number,
): Map<string, Circle> {
  const items = [...inputs]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((input) => {
      const home = frame.project(input.lon, input.lat);
      return {
        id: input.id,
        home,
        x: home.x,
        y: home.y,
        r: circleDiameter(input.capacity, frame.width, minDiameter) / 2,
      };
    });

  for (let iteration = 0; iteration < 300; iteration++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]!;
        const b = items[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        const needed = a.r + b.r + GAP_PX;
        if (distance >= needed - 1e-6) continue;
        if (distance < 1e-6) {
          // Same spot: separate along a fixed direction derived from the pair's order.
          const angle = ((i * 7 + j * 13) % 360) * (Math.PI / 180);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const push = (needed - Math.hypot(b.x - a.x, b.y - a.y)) / 2;
        a.x -= (dx / distance) * push;
        a.y -= (dy / distance) * push;
        b.x += (dx / distance) * push;
        b.y += (dy / distance) * push;
        moved = true;
      }
    }
    for (const item of items) clampToHome(item);
    if (!moved) break;
  }

  return new Map(
    items.map((item) => [item.id, { x: round(item.x), y: round(item.y), r: round(item.r) }]),
  );
}

function clampToHome(item: { home: { x: number; y: number }; x: number; y: number }) {
  const dx = item.x - item.home.x;
  const dy = item.y - item.home.y;
  const shift = Math.hypot(dx, dy);
  if (shift > MAX_SHIFT_PX) {
    item.x = item.home.x + (dx / shift) * MAX_SHIFT_PX;
    item.y = item.home.y + (dy / shift) * MAX_SHIFT_PX;
  }
}

const round = (value: number) => Math.round(value * 10) / 10;
