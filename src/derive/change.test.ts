import { describe, expect, it } from "vitest";
import { changeSinceYesterday, type Measurement } from "./change.ts";

const m = (measuredAt: string, level: number | null): Measurement => ({ measuredAt, level });
const today = m("2026-11-22T07:00:00+01:00", 491.32);
const yesterday = m("2026-11-21T07:00:00+01:00", 491.2);

describe("changeSinceYesterday", () => {
  it("reports a rise in whole centimetres (spec: Level rose)", () => {
    expect(changeSinceYesterday(today, yesterday, [yesterday])).toBe(12);
  });

  it("reports a fall as negative", () => {
    expect(
      changeSinceYesterday(m("2026-11-22T07:00:00+01:00", 491.17), yesterday, [yesterday]),
    ).toBe(-3);
  });

  it("reports 0 for under 1 cm either way (spec: No meaningful change)", () => {
    const tiny = m("2026-11-22T07:00:00+01:00", 491.204);
    expect(changeSinceYesterday(tiny, yesterday, [yesterday])).toBe(0);
  });

  it("is unknown on the first day (spec: First day)", () => {
    expect(changeSinceYesterday(today, undefined, [])).toBeNull();
  });

  it("is unknown when the portal repeats yesterday's measurement (spec: Portal did not update)", () => {
    const repeated = m("2026-11-21T07:00:00+01:00", 491.2);
    const twoDaysAgo = m("2026-11-20T07:00:00+01:00", 491.0);
    // Even though the snapshot from two days ago is 24 h older than the repeated value.
    expect(changeSinceYesterday(repeated, repeated, [repeated, twoDaysAgo])).toBeNull();
  });

  it("uses only measurements 18 to 30 hours earlier, closest to 24 h", () => {
    const tooRecent = m("2026-11-21T14:00:00+01:00", 400); // 17 h
    const tooOld = m("2026-11-21T00:30:00+01:00", 400); // 30.5 h
    expect(changeSinceYesterday(today, yesterday, [tooRecent, tooOld])).toBeNull();
    const at20h = m("2026-11-21T11:00:00+01:00", 491.0);
    expect(changeSinceYesterday(today, yesterday, [at20h, yesterday])).toBe(12);
  });

  it("handles the night summer time ends (25-hour day)", () => {
    const before = m("2027-10-30T07:00:00+02:00", 300.0);
    const after = m("2027-10-31T07:00:00+01:00", 300.05);
    expect(changeSinceYesterday(after, before, [before])).toBe(5);
  });

  it("is unknown without a current level, or with no earlier level", () => {
    expect(
      changeSinceYesterday(m("2026-11-22T07:00:00+01:00", null), yesterday, [yesterday]),
    ).toBeNull();
    expect(
      changeSinceYesterday(today, yesterday, [m("2026-11-21T07:00:00+01:00", null)]),
    ).toBeNull();
  });
});
