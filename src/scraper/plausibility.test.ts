import { describe, expect, it } from "vitest";
import { checkPlausibility, type StationContext, type StationValues } from "./plausibility.ts";

// Slezská Harta's real levels from its detail page (design doc data model).
const harta: StationContext = {
  name: "VD Slezská Harta",
  levels: { crest: 500.8, permanent: 452 },
  plannedDrawdownActive: false,
};

const zone = (filledPct: number | null, freePct: number | null = null) => ({
  filled: 1,
  filledPct,
  free: 1,
  freePct,
});

const values = (level: number | null, storagePct: number | null = 60): StationValues => ({
  level,
  zones: {
    storage: zone(storagePct, storagePct === null ? null : 100 - storagePct),
    retentionControllable: zone(0, 100),
    retentionUncontrollable: "undefined-zone",
  },
});

describe("checkPlausibility", () => {
  it("keeps normal values without warnings", () => {
    const result = checkPlausibility(values(491.13), harta);
    expect(result.level).toBe(491.13);
    expect(result.zones.storage).toMatchObject({ filledPct: 60, freePct: 40 });
    expect(result.warnings).toEqual([]);
  });

  it("drops a level 3 m above the crest (spec: Level far above the crest)", () => {
    const result = checkPlausibility(values(503.8), harta);
    expect(result.level).toBeNull();
    expect(result.warnings).toEqual([
      expect.stringMatching(/^VD Slezská Harta: level 503\.8 m .* crest/),
    ]);
  });

  it("keeps a level up to 2 m above the crest", () => {
    expect(checkPlausibility(values(502.8), harta).level).toBe(502.8);
  });

  it("drops a level more than 20 m below the permanent pool", () => {
    const result = checkPlausibility(values(430), harta);
    expect(result.level).toBeNull();
    expect(result.warnings).toHaveLength(1);
  });

  it("keeps it for an active planned drawdown (spec: Reservoir emptied for repairs)", () => {
    const result = checkPlausibility(values(422), { ...harta, plannedDrawdownActive: true });
    expect(result.level).toBe(422);
    expect(result.warnings).toEqual([]);
  });

  it("still drops a level far above the crest during a planned drawdown", () => {
    expect(
      checkPlausibility(values(510), { ...harta, plannedDrawdownActive: true }).level,
    ).toBeNull();
  });

  it("skips a level check when the registry does not know the level", () => {
    const unknown = { ...harta, levels: { crest: null, permanent: null } };
    expect(checkPlausibility(values(9999), unknown).level).toBe(9999);
  });

  it("drops percentages below 0 or above 150, keeping 104 %", () => {
    expect(checkPlausibility(values(491, 104), harta).zones.storage).toMatchObject({
      filledPct: 104,
    });
    const high = checkPlausibility(values(491, 151), harta);
    expect(high.zones.storage).toMatchObject({ filledPct: null, freePct: null });
    expect(high.warnings).toHaveLength(2);
    expect(checkPlausibility(values(491, -1), harta).zones.storage).toMatchObject({
      filledPct: null,
    });
  });

  it("leaves a zone that is not defined, and blank values, as they are", () => {
    const result = checkPlausibility(values(null, null), harta);
    expect(result.level).toBeNull();
    expect(result.zones.retentionUncontrollable).toBe("undefined-zone");
    expect(result.zones.storage).toMatchObject({ filledPct: null, freePct: null });
    expect(result.warnings).toEqual([]);
  });
});
