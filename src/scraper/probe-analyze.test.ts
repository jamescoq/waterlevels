import { describe, expect, it } from "vitest";
import { analyzePage, withPragueOffset } from "./probe-analyze.ts";

// Trimmed to the structure of a real MGE portal page; not a saved portal page (those come in
// tasks 3.1).
const page = `
<table>
  <tr><th colspan="3">Přehled měření 22.11.2026</th></tr>
  <tr><th>Nádrž</th><th>Tok</th><th>Datum</th><th>Hladina vody v nádrži</th><th>Objem</th></tr>
  <tr><th></th><th></th><th></th><th>m n.m.</th><th>mil [m 3 ]</th></tr>
  <tr><td><a href="Mereni.aspx?id=1&amp;oid=1">VD Kružberk</a></td><td>Moravice</td>
      <td><span>22.11.2026 10:10</span></td><td>427,71</td><td>26,65</td></tr>
  <tr><td><a href="Mereni.aspx?id=2&amp;oid=1">VD Šance</a></td><td>Ostravice</td>
      <td><span>22.11.2026 09:00</span></td><td>496,12</td><td>40,10</td></tr>
  <tr><td><a href="Mereni.aspx?id=2&amp;oid=1">VD Šance přepočítaná</a></td><td>Ostravice</td>
      <td><span>22.11.2026 09:00</span></td><td>496,12</td><td>40,10</td></tr>
</table>`;

describe("analyzePage", () => {
  const result = analyzePage(page);

  it("counts rows and distinct stations separately", () => {
    expect(result.rows).toBe(3);
    expect(result.stations).toBe(2);
  });

  it("reads column headings without the units row", () => {
    expect(result.columns).toEqual(["Nádrž", "Tok", "Datum", "Hladina vody v nádrži", "Objem"]);
  });

  it("finds the oldest and newest measurement", () => {
    expect(result.oldestMeasurement).toBe("22.11.2026 09:00");
    expect(result.newestMeasurement).toBe("22.11.2026 10:10");
    expect(result.newestMeasurementIso).toBe("2026-11-22T10:10:00+01:00");
  });

  it("reports an empty page as having no stations", () => {
    expect(analyzePage("<html><body>Údržba</body></html>")).toMatchObject({
      rows: 0,
      stations: 0,
      newestMeasurement: null,
    });
  });
});

describe("withPragueOffset", () => {
  it("uses +01:00 in winter and +02:00 in summer", () => {
    expect(withPragueOffset("2026-11-22T07:00")).toBe("2026-11-22T07:00:00+01:00");
    expect(withPragueOffset("2027-07-01T07:00")).toBe("2027-07-01T07:00:00+02:00");
  });
});
