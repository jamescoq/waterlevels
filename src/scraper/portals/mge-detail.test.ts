import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SourceCode } from "../sources.ts";
import { parseDetail, type StationDetail } from "./mge-detail.ts";
import { LayoutError } from "./mge.ts";

const detail = (source: SourceCode, name: string) =>
  parseDetail(
    readFileSync(
      join(import.meta.dirname, "../../../test/fixtures", source, "detail.html"),
      "utf8",
    ),
    name,
  );

// Expected values were read from the fixture HTML with a separate script.
describe("parseDetail", () => {
  it("reads Slezská Harta's levels (the design doc's real values)", () => {
    expect(detail("pod", "VD Slezská Harta")).toEqual<StationDetail>({
      river: "Moravice",
      purpose: "Víceúčelová",
      levels: { crest: 500.8, spillway: 496.83, maxRetention: 498.8, storage: 496, permanent: 452 },
      heightDatum: "Balt p.v.",
      // The portal repeats the station name in the note.
      note: "",
    });
  });

  it("reads Dalešice (Moravy)", () => {
    expect(detail("pmo", "VD Dalešice").levels).toEqual({
      crest: 384,
      spillway: 381.5,
      maxRetention: 380.5,
      storage: 380.5,
      permanent: 362.6,
    });
  });

  it("keeps a real note (Ohře, Fláje)", () => {
    const fl = detail("poh", "VD Fláje");
    expect(fl.purpose).toBe("Vodárenská");
    expect(fl.levels.permanent).toBe(710.81);
    expect(fl.note).toMatch(/z 19,5 mil\. m3 na 17,5 mil\. m3\.$/);
  });

  it("returns no purpose where the portal gives none (Vltava)", () => {
    expect(detail("pvl", "VD Bílsko")).toMatchObject({
      river: "Bílský potok",
      purpose: null,
      levels: { crest: 471.7, storage: 464.03, permanent: 463.03 },
    });
  });

  it("reads Labe", () => {
    expect(detail("pla", "Bedřichov").levels).toEqual({
      crest: 775.26,
      spillway: 774.08,
      maxRetention: 774.38,
      storage: 773.48,
      permanent: 764.48,
    });
  });

  it("fails loudly on a page without the info table", () => {
    expect(() => parseDetail("<html><body>Údržba</body></html>", "VD Test")).toThrow(LayoutError);
  });
});
