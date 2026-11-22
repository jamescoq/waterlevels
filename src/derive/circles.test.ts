import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GAP_PX,
  MAX_SHIFT_PX,
  MIN_DIAMETER_DESKTOP,
  MIN_DIAMETER_PHONE,
  circleDiameter,
  layoutCircles,
  type CircleInput,
} from "./circles.ts";
import { StationsFileSchema } from "../shared/registry.ts";
import { DESKTOP_MAP_WIDTH, PHONE_MAP_WIDTH, mapFrame } from "../shared/projection.ts";

const desktop = mapFrame(DESKTOP_MAP_WIDTH);
const phone = mapFrame(PHONE_MAP_WIDTH);

describe("circleDiameter (spec: Circle size)", () => {
  it("is 43 px for 182 mil. m³ on an 880 px map (spec: Large reservoir)", () => {
    expect(Math.round(circleDiameter(182, 880, MIN_DIAMETER_DESKTOP))).toBe(43);
  });

  it("is held at 18 px for 0.5 mil. m³ on desktop (spec: Small reservoir on desktop)", () => {
    expect(circleDiameter(0.5, 880, MIN_DIAMETER_DESKTOP)).toBe(18);
  });

  it("uses the minimum when capacity is unknown (spec: Dam without a storage zone)", () => {
    expect(circleDiameter(null, 880, MIN_DIAMETER_DESKTOP)).toBe(18);
    expect(circleDiameter(null, PHONE_MAP_WIDTH, MIN_DIAMETER_PHONE)).toBe(10);
  });

  it("scales with the map, with the phone minimum of 10 px", () => {
    expect(circleDiameter(182, 440, MIN_DIAMETER_DESKTOP)).toBeCloseTo(21.5, 0);
    expect(circleDiameter(0.5, PHONE_MAP_WIDTH, MIN_DIAMETER_PHONE)).toBe(10);
  });
});

describe("mapFrame", () => {
  it("places Czechia inside the frame, west to east and north to south", () => {
    const prague = desktop.project(14.42, 50.09);
    const ostrava = desktop.project(18.29, 49.83);
    const ceskeBudejovice = desktop.project(14.47, 48.97);
    for (const p of [prague, ostrava, ceskeBudejovice]) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(desktop.width);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(desktop.height);
    }
    expect(ostrava.x).toBeGreaterThan(prague.x);
    expect(ceskeBudejovice.y).toBeGreaterThan(prague.y);
  });

  it("gives a landscape frame of roughly Czechia's shape", () => {
    expect(desktop.height / desktop.width).toBeGreaterThan(0.5);
    expect(desktop.height / desktop.width).toBeLessThan(0.7);
  });
});

const gapBetween = (
  a: { x: number; y: number; r: number },
  b: { x: number; y: number; r: number },
) => Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;

describe("layoutCircles (spec: Overlap handling)", () => {
  it("separates two neighbouring dams by 3 px within 16 px of their true spots", () => {
    const inputs: CircleInput[] = [
      { id: "a", lon: 14.4, lat: 49.5, capacity: 50 },
      { id: "b", lon: 14.45, lat: 49.5, capacity: 50 },
    ];
    const layout = layoutCircles(inputs, desktop, MIN_DIAMETER_DESKTOP);
    const a = layout.get("a")!;
    const b = layout.get("b")!;
    expect(gapBetween(a, b)).toBeGreaterThanOrEqual(GAP_PX - 0.2);
    for (const input of inputs) {
      const home = desktop.project(input.lon, input.lat);
      const placed = layout.get(input.id)!;
      expect(Math.hypot(placed.x - home.x, placed.y - home.y)).toBeLessThanOrEqual(
        MAX_SHIFT_PX + 0.1,
      );
    }
  });

  it("keeps every circle of a dense cluster within 16 px, even if some still overlap", () => {
    const inputs: CircleInput[] = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      lon: 16.6,
      lat: 48.9,
      capacity: 100,
    }));
    const layout = layoutCircles(inputs, desktop, MIN_DIAMETER_DESKTOP);
    const home = desktop.project(16.6, 48.9);
    for (const c of layout.values()) {
      expect(Math.hypot(c.x - home.x, c.y - home.y)).toBeLessThanOrEqual(MAX_SHIFT_PX + 0.1);
    }
    const spots = new Set([...layout.values()].map((c) => `${c.x},${c.y}`));
    expect(spots.size).toBe(6);
  });

  it("gives the same layout for the same input", () => {
    const inputs: CircleInput[] = [
      { id: "x", lon: 15, lat: 50, capacity: 10 },
      { id: "y", lon: 15.01, lat: 50, capacity: 20 },
    ];
    expect([...layoutCircles(inputs, desktop, 18)]).toEqual([
      ...layoutCircles([...inputs].reverse(), desktop, 18),
    ]);
  });

  it("moves no real station more than 16 px, on desktop or phone", () => {
    const registry = StationsFileSchema.parse(
      JSON.parse(readFileSync(join(import.meta.dirname, "../../registry/stations.json"), "utf8")),
    );
    const inputs = registry.stations
      .filter((s) => s.lat !== null && s.lon !== null)
      .map((s) => ({ id: s.id, lon: s.lon!, lat: s.lat!, capacity: s.storageVolume }));
    for (const [frame, min] of [
      [desktop, MIN_DIAMETER_DESKTOP],
      [phone, MIN_DIAMETER_PHONE],
    ] as const) {
      const layout = layoutCircles(inputs, frame, min);
      for (const input of inputs) {
        const home = frame.project(input.lon, input.lat);
        const placed = layout.get(input.id)!;
        expect(Math.hypot(placed.x - home.x, placed.y - home.y), input.id).toBeLessThanOrEqual(
          MAX_SHIFT_PX + 0.1,
        );
      }
    }
  });
});
