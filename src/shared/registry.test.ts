import { describe, expect, it } from "vitest";
import {
  OverridesFileSchema,
  StationsFileSchema,
  isOverrideActive,
  slugOf,
  type Station,
} from "./registry.ts";

const station = (over: Partial<Station> = {}): Station => ({
  id: "pod-slezska-harta",
  kind: "reservoir",
  name: "VD Slezská Harta",
  source: "pod",
  basin: "odry",
  river: "Moravice",
  portalId: { id: "300021251", oid: "1" },
  sourceUrl: "https://www.pod.cz/portal/Nadrze/cz/pc/Mereni.aspx?id=300021251&oid=1",
  lat: 49.89,
  lon: 17.55,
  coordinateSource: "manual",
  levels: { crest: 500.8, spillway: 496.83, maxRetention: 498.8, storage: 496, permanent: 452 },
  heightDatum: "Balt p.v.",
  storageVolume: 186.23,
  portalPurpose: "Víceúčelová",
  purposes: [],
  hidden: false,
  ...over,
});

const file = (stations: Station[], ignoredRows = []) => ({
  schemaVersion: 1,
  stations,
  ignoredRows,
});

describe("StationsFileSchema", () => {
  it("accepts a valid station", () => {
    expect(StationsFileSchema.safeParse(file([station()])).success).toBe(true);
  });

  it("accepts a station without coordinates yet", () => {
    const s = station({ lat: null, lon: null, coordinateSource: null });
    expect(StationsFileSchema.safeParse(file([s])).success).toBe(true);
  });

  it("rejects duplicate ids and duplicate portal ids", () => {
    const twin = station({ name: "Twin" });
    expect(StationsFileSchema.safeParse(file([station(), twin])).success).toBe(false);
    const samePortal = station({ id: "pod-other" });
    expect(StationsFileSchema.safeParse(file([station(), samePortal])).success).toBe(false);
  });

  it("rejects an id that does not start with its source code", () => {
    expect(StationsFileSchema.safeParse(file([station({ id: "pmo-slezska-harta" })])).success).toBe(
      false,
    );
  });

  it("rejects coordinates outside Czechia and half-set coordinates", () => {
    expect(StationsFileSchema.safeParse(file([station({ lat: 52.5 })])).success).toBe(false);
    expect(StationsFileSchema.safeParse(file([station({ lon: null })])).success).toBe(false);
  });

  it("rejects unknown fields, so typos in the hand-kept file are caught", () => {
    expect(
      StationsFileSchema.safeParse(file([{ ...station(), hiden: true } as Station])).success,
    ).toBe(false);
  });
});

describe("OverridesFileSchema", () => {
  it("accepts a planned drawdown", () => {
    const ok = {
      "pvl-hracholusky": { status: "planned", reason: "Oprava hráze", until: "2027-03-31" },
    };
    expect(OverridesFileSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects a range that ends before it starts, or a malformed date", () => {
    const backwards = {
      x: { status: "planned", reason: "r", from: "2027-04-01", until: "2027-03-31" },
    };
    expect(OverridesFileSchema.safeParse(backwards).success).toBe(false);
    const malformed = { x: { status: "planned", reason: "r", until: "31.3.2027" } };
    expect(OverridesFileSchema.safeParse(malformed).success).toBe(false);
  });
});

describe("isOverrideActive (spec: Active entry, Expired entry)", () => {
  const entry = { status: "planned" as const, reason: "Oprava hráze", until: "2027-03-31" };

  it("applies within its range, including the last day", () => {
    expect(isOverrideActive(entry, "2027-03-01")).toBe(true);
    expect(isOverrideActive(entry, "2027-03-31")).toBe(true);
  });

  it("is ignored after its end date and before its start date", () => {
    expect(isOverrideActive(entry, "2027-04-01")).toBe(false);
    expect(isOverrideActive({ ...entry, from: "2027-01-01" }, "2026-12-31")).toBe(false);
  });
});

describe("slugOf", () => {
  it.each([
    ["VD Slezská Harta", "slezska-harta"],
    ["VD Plzeň-Štruncovy sady", "plzen-struncovy-sady"],
    ["Nové Mlýny - Horní nádrž", "nove-mlyny-horni-nadrz"],
    ["VD Švihov (Želivka)", "svihov-zelivka"],
    ["VD Lipno 1", "lipno-1"],
    ["Bedřichov", "bedrichov"],
  ])("%s → %s", (name, slug) => {
    expect(slugOf(name)).toBe(slug);
  });
});
