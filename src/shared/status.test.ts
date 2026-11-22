import { describe, expect, it } from "vitest";
import { deriveStatus, isStale, type StatusInput } from "./status.ts";

const now = new Date("2026-11-22T10:00:00+01:00");

const base: StatusInput = {
  sourceStatus: "ok",
  measuredAt: "2026-11-22T07:00:00+01:00",
  level: 491.13,
  storageLevel: 496,
  storage: { filledPct: 55 },
  retentionFilled: 0,
  plannedDrawdownActive: false,
};
const status = (over: Partial<StatusInput>, at = now) => deriveStatus({ ...base, ...over }, at);

// One row per spec scenario of station-status.
describe("deriveStatus", () => {
  it.each<[string, Partial<StatusInput>, string, string | null]>([
    // Status precedence
    [
      "Planned drawdown at low fill",
      { plannedDrawdownActive: true, storage: { filledPct: 20 } },
      "planned",
      null,
    ],
    [
      "No data wins over a planned drawdown",
      { plannedDrawdownActive: true, sourceStatus: "failed" },
      "no-data",
      null,
    ],
    // No data
    ["Source failed today", { sourceStatus: "failed" }, "no-data", null],
    ["Source returned too few rows", { sourceStatus: "partial" }, "no-data", null],
    ["Source paused", { sourceStatus: "paused" }, "no-data", null],
    ["Source blocked by robots.txt", { sourceStatus: "blocked" }, "no-data", null],
    ["No measurement time at all", { measuredAt: null }, "no-data", null],
    [
      "Neither level nor fill published",
      { level: null, storage: { filledPct: null } },
      "no-data",
      null,
    ],
    // Above the storage level
    ["Retention in use", { retentionFilled: 0.4 }, "above-storage", null],
    ["Fill above 100 %", { storage: { filledPct: 104 } }, "above-storage", null],
    ["Level above the top of the storage zone", { level: 496.2 }, "above-storage", null],
    // Level only
    ["No storage zone", { storage: "undefined-zone" }, "level-only", "no-zone"],
    ["Fill not published", { storage: { filledPct: null } }, "level-only", "fill-not-published"],
    // Fill rating
    ["Exactly 70 %", { storage: { filledPct: 70 } }, "high", null],
    ["Exactly 40 %", { storage: { filledPct: 40 } }, "medium", null],
    ["Just under 40 %", { storage: { filledPct: 39.9 } }, "low", null],
    ["Just under 70 %", { storage: { filledPct: 69.99 } }, "medium", null],
  ])("%s", (_, over, expected, reason) => {
    expect(status(over)).toEqual({ status: expected, levelOnlyReason: reason });
  });

  it("turns a station grey 37 hours after its measurement (spec: Collection stopped)", () => {
    const later = new Date("2026-11-23T20:00:00+01:00"); // 37 h after 07:00 the day before
    expect(status({}, later).status).toBe("no-data");
    const just = new Date("2026-11-23T19:00:00+01:00"); // exactly 36 h
    expect(status({}, just).status).toBe("medium");
  });

  it("checks retention and level before the missing zone", () => {
    expect(status({ storage: "undefined-zone", retentionFilled: 1.2 }).status).toBe(
      "above-storage",
    );
  });

  it("treats unmeasured retention as not in use", () => {
    expect(status({ retentionFilled: null }).status).toBe("medium");
  });
});

describe("isStale", () => {
  it("compares across offsets", () => {
    expect(isStale("2026-11-21T00:00:00+02:00", new Date("2026-11-22T10:00:00Z"))).toBe(false);
    expect(isStale("2026-11-20T00:00:00Z", new Date("2026-11-22T10:00:00Z"))).toBe(true);
  });
});
