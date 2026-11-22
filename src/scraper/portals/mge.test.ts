import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SourceCode } from "../sources.ts";
import {
  LayoutError,
  parseOverview,
  parseVolumes,
  type OverviewRow,
  type VolumesRow,
} from "./mge.ts";

const fixture = (source: SourceCode, page: "overview" | "volumes") =>
  readFileSync(join(import.meta.dirname, "../../../test/fixtures", source, `${page}.html`), "utf8");

const overview = (source: SourceCode) => parseOverview(fixture(source, "overview"));
const volumes = (source: SourceCode) => parseVolumes(fixture(source, "volumes"));

const find = <T extends { name: string }>(rows: T[], name: string): T => {
  const row = rows.find((r) => r.name === name);
  if (!row) throw new Error(`no row ${name}`);
  return row;
};

// Expected values below were read from the fixture HTML with a separate script, not from
// this parser's output.

describe.each([
  ["pmo", 29],
  ["pod", 7],
  ["poh", 24],
  ["pvl", 42],
  ["pla", 16],
] as const)("%s fixtures", (source, count) => {
  it(`parses ${count} rows on both pages, with matching station ids`, () => {
    const o = overview(source);
    const v = volumes(source);
    expect(o).toHaveLength(count);
    expect(v).toHaveLength(count);
    const ids = (rows: { portalId: { id: string; oid: string } }[]) =>
      rows.map((r) => `${r.portalId.id}/${r.portalId.oid}`).sort();
    expect(ids(v)).toEqual(ids(o));
  });

  it("gives a measurement time and a level to every row except the known gaps", () => {
    for (const row of overview(source)) {
      if (row.measuredAt !== null) {
        expect(row.measuredAt, row.name).toMatch(/^2026-11-22T\d{2}:\d{2}:00\+01:00$/);
      }
    }
    const withoutTime = overview(source).filter((r) => r.measuredAt === null);
    const withoutLevel = overview(source).filter((r) => r.level === null);
    expect(withoutTime.map((r) => r.name)).toEqual(NO_TIME[source] ?? []);
    expect(withoutLevel.map((r) => r.name)).toEqual(NO_LEVEL[source] ?? []);
  });
});

// Gaps in the published data on 2026-11-22, not parser failures.
const NO_TIME: Partial<Record<SourceCode, string[]>> = {
  pvl: ["VD Čihadla", "VD Jince", "VD Plzeň-Štruncovy sady"],
};
const NO_LEVEL: Partial<Record<SourceCode, string[]>> = {
  // VD Žlutice: "Hladina ručně 1x denně v 7:00." (level read by hand once a day).
  pvl: ["VD Čihadla", "VD Jince", "VD Plzeň-Štruncovy sady", "VD Žlutice"],
};

describe("parseOverview", () => {
  it("reads every column of Povodí Odry, including outflow", () => {
    expect(find(overview("pod"), "VD Slezská Harta")).toEqual<OverviewRow>({
      portalId: { id: "300021251", oid: "1" },
      name: "VD Slezská Harta",
      river: "Moravice",
      purpose: "Víceúčelová",
      measuredAt: "2026-11-22T10:30:00+01:00",
      level: 491.13,
      volume: 155.49,
      inflow: 4.54,
      outflow: 4.54,
      precipitation1h: null,
      precipitation24h: null,
      airTemperature: 3,
      floodThresholds: { Qa: 4.77, Q1: 46, Q5: 100, Q20: 158, Q100: 235 },
      // The portal repeats the station name in the note column; that is not a note.
      note: "",
    });
  });

  it("leaves outflow empty where the portal has no such column (Labe)", () => {
    expect(find(overview("pla"), "Bedřichov")).toMatchObject({
      portalId: { id: "100", oid: "1" },
      measuredAt: "2026-11-22T10:20:00+01:00",
      level: 773.64,
      volume: 1.81,
      inflow: null,
      outflow: null,
      precipitation1h: null,
      precipitation24h: 3.5,
      airTemperature: -1.11,
      floodThresholds: { Qa: 0.27, Q1: 4.57, Q5: 12.9, Q20: 24, Q100: 41.9 },
    });
  });

  it("handles a portal without a purpose column and with text station ids (Vltava)", () => {
    expect(find(overview("pvl"), "VD Bílsko")).toMatchObject({
      portalId: { id: "BIBI", oid: "1" },
      purpose: null,
      level: 463.42,
      volume: null,
      inflow: null,
      outflow: null,
      airTemperature: null,
      floodThresholds: { Qa: 0.03, Q1: 2.1, Q5: 6.7, Q20: 13.9, Q100: 25 },
    });
  });

  it("keeps both Dalešice rows, which have different ids", () => {
    const rows = overview("pmo").filter((r) => r.name.startsWith("VD Dalešice"));
    expect(rows.map((r) => [r.name, r.portalId.id, r.level])).toEqual([
      ["VD Dalešice", "14", 374.23],
      ["VD Dalešice - přepočítaná", "29", 374.41],
    ]);
  });

  it("keeps a real portal note verbatim", () => {
    expect(find(overview("poh"), "VD Fláje").note).toMatch(
      /^Od 1\.11\.2021 do 31\.12\.2027 je pro VD Fláje schválená mimořádná manipulace/,
    );
  });

  it("returns no rows for a page without a station table", () => {
    expect(parseOverview("<html><body><h1>Údržba</h1></body></html>")).toEqual([]);
  });
});

describe("parseVolumes", () => {
  it("reads filled and free volume of each zone (Odra)", () => {
    expect(find(volumes("pod"), "VD Kružberk")).toEqual<VolumesRow>({
      portalId: { id: "300044836", oid: "1" },
      name: "VD Kružberk",
      measuredAt: "2026-11-22T10:30:00+01:00",
      storage: { filled: 22.63, filledPct: 92.06, free: 1.95, freePct: 7.94 },
      retentionControllable: { filled: 0, filledPct: 0, free: 6.927, freePct: 100 },
      // Blank cells: not measured, which is not the same as "not defined".
      retentionUncontrollable: { filled: null, filledPct: null, free: null, freePct: null },
    });
  });

  it("marks a zone with dashes as not defined (Moravy)", () => {
    expect(find(volumes("pmo"), "VD Bojkovice")).toMatchObject({
      storage: { filled: 0.4, filledPct: 52.2, free: 0.37, freePct: 47.8 },
      retentionControllable: "undefined-zone",
      retentionUncontrollable: { filled: 0, filledPct: 0, free: 0.153, freePct: 100 },
    });
  });

  it("marks a zone as not defined when only the volume cells carry dashes (Labe)", () => {
    expect(find(volumes("pla"), "Křižanovice")).toMatchObject({
      storage: { filled: 1.16, filledPct: 79.62, free: 0.3, freePct: 20.38 },
      retentionControllable: "undefined-zone",
      retentionUncontrollable: "undefined-zone",
    });
  });

  it("keeps a blank storage fill as not measured (Vltava publishes none for 7 stations)", () => {
    const blank = volumes("pvl").filter(
      (r) => r.storage !== "undefined-zone" && r.storage.filledPct === null,
    );
    expect(blank.map((r) => r.name)).toEqual([
      "VD Bílsko",
      "VD Čihadla",
      "VD Dolejší Padrťský rybník",
      "VD Hořejší Padrťský rybník",
      "VD Jince",
      "VD Plzeň-Štruncovy sady",
      "VD Žlutice",
    ]);
  });

  it("reads a portal without a purpose column (Vltava)", () => {
    expect(find(volumes("pvl"), "VD Lipno 1")).toMatchObject({
      portalId: { id: "VLL1", oid: "1" },
      storage: { filled: 117.71, filledPct: 46.53, free: 135.28, freePct: 53.47 },
      retentionControllable: { filled: 0, filledPct: 0, free: 33.156, freePct: 100 },
      retentionUncontrollable: "undefined-zone",
    });
  });
});

describe("layout changes fail loudly", () => {
  const page = (header: string, cells: string) => `
    <table>
      <tr><th>Nádrž</th><th>Tok</th><th>Datum</th>${header}</tr>
      <tr><td><a href="Mereni.aspx?id=1&amp;oid=1">VD Test</a></td><td>Řeka</td>
          <td>22.11.2026 10:10</td>${cells}</tr>
    </table>`;

  it("rejects an unknown column heading", () => {
    expect(() =>
      parseOverview(
        page("<th>Hladina vody v nádrži</th><th>Nový sloupec</th>", "<td>1,0</td><td>2</td>"),
      ),
    ).toThrow(LayoutError);
  });

  it("rejects a row whose cell count does not match the header", () => {
    expect(() =>
      parseOverview(page("<th>Hladina vody v nádrži</th>", "<td>1,0</td><td>2</td>")),
    ).toThrow(/2 cells|cells for/);
  });

  it("rejects a value that is not a number", () => {
    expect(() =>
      parseOverview(page("<th>Hladina vody v nádrži</th>", "<td>neměřeno</td>")),
    ).toThrow(/VD Test, level/);
  });

  it("rejects an overview page without a level column", () => {
    expect(() => parseOverview(page("<th>Objem</th>", "<td>1,0</td>"))).toThrow(/no level column/);
  });

  it("rejects a volumes page without the zone columns", () => {
    expect(() => parseVolumes(page("<th>Objem</th>", "<td>1,0</td>"))).toThrow(
      /no storage filled column/,
    );
  });
});
