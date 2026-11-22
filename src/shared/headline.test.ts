import { describe, expect, it } from "vitest";
import { computeHeadline, headlineText, visibleStatus, type HeadlineStation } from "./headline.ts";
import type { Status } from "./status.ts";

const many = (
  n: number,
  status: Status,
  filled: number | null = null,
  capacity: number | null = null,
) =>
  Array.from({ length: n }, (): HeadlineStation => ({
    status,
    storageFilled: filled,
    storageCapacity: capacity,
  }));

describe("computeHeadline and headlineText", () => {
  it("counts reservoirs above 70 % (spec: Typical day)", () => {
    const stations = [...many(3, "above-storage"), ...many(22, "high"), ...many(12, "medium")];
    const h = computeHeadline(stations);
    expect(headlineText(h).main).toBe("V 25 z 37 nádrží je zásoba vody nad 70 %");
  });

  it("weights fill by volume (spec: Weighted figure)", () => {
    const h = computeHeadline([
      { status: "high", storageFilled: 600, storageCapacity: 800 },
      { status: "low", storageFilled: 100, storageCapacity: 200 },
    ]);
    expect(h.weightedFillPct).toBe(70);
    expect(headlineText(h).weighted).toBe("Souhrnná naplněnost zásobních prostorů je 70 %.");
  });

  it("leaves planned drawdowns, missing data and level-only stations out of the weighted figure (spec: Planned drawdown excluded)", () => {
    const h = computeHeadline([
      { status: "high", storageFilled: 70, storageCapacity: 100 },
      { status: "planned", storageFilled: 10, storageCapacity: 900 },
      { status: "no-data", storageFilled: 10, storageCapacity: 900 },
      { status: "level-only", storageFilled: null, storageCapacity: null },
    ]);
    expect(h.weightedFillPct).toBe(70);
  });

  it("counts stations outside the rating together (spec: Stations outside the rating)", () => {
    const h = computeHeadline([
      ...many(2, "no-data"),
      ...many(1, "planned"),
      ...many(1, "level-only"),
      ...many(5, "high"),
    ]);
    expect(h.outsideRating).toBe(4);
    expect(h.statusCounts).toMatchObject({ "no-data": 2, planned: 1, "level-only": 1, high: 5 });
  });

  it("follows stations that went stale in the browser (spec: Some data aged in the browser)", () => {
    const h = computeHeadline([...many(20, "high"), ...many(7, "no-data"), ...many(10, "medium")]);
    expect(headlineText(h).main).toBe("V 20 z 37 nádrží je zásoba vody nad 70 %");
  });

  it("states no count when nothing is rated (spec: All data aged in the browser)", () => {
    const h = computeHeadline(many(37, "no-data", 10, 20));
    expect(headlineText(h)).toEqual({ main: "Aktuální data nejsou k dispozici.", weighted: null });
  });

  it("omits the weighted sentence when no rated station has volumes (spec: Nothing to weigh)", () => {
    expect(headlineText(computeHeadline(many(3, "high"))).weighted).toBeNull();
  });
});

describe("visibleStatus", () => {
  const measured = "2026-11-22T07:00:00+01:00";

  it("keeps the build's status while the data is fresh", () => {
    expect(visibleStatus("high", measured, new Date("2026-11-22T12:00:00+01:00"))).toBe("high");
  });

  it("shows Bez dat once the measurement is over 36 hours old", () => {
    expect(visibleStatus("high", measured, new Date("2026-11-23T20:00:00+01:00"))).toBe("no-data");
  });
});
