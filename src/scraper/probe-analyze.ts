import * as cheerio from "cheerio";

export interface PageAnalysis {
  /** Table rows that link to a station detail page. */
  rows: number;
  /** Distinct stations by the detail link's id and oid. */
  stations: number;
  /** Column headings of the station table, in order, units left out. */
  columns: string[];
  /** Oldest and newest measurement time found in station rows, as shown ("22.11.2026 10:10"). */
  oldestMeasurement: string | null;
  newestMeasurement: string | null;
  /** Newest measurement as an ISO time with the Prague offset. */
  newestMeasurementIso: string | null;
}

const DATE_TIME = /(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})\s+(\d{1,2}):(\d{2})/;
const UNIT_HEADING = /^(\[.*\]|mil \[.*\]|m n\.m\.|\[%\])$/;

/** Reads the shape of an MGE portal overview or volumes page, for the probe report. */
export function analyzePage(html: string): PageAnalysis {
  const $ = cheerio.load(html);
  const links = $('a[href*="Mereni.aspx"]');

  const stationKeys = new Set<string>();
  const times: { shown: string; key: string }[] = [];
  const rowElements = new Set<unknown>();

  links.each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const params = new URLSearchParams(href.split("?")[1] ?? "");
    stationKeys.add(`${params.get("id")}/${params.get("oid")}`);

    const row = $(el).closest("tr");
    const rowEl = row.get(0);
    if (!rowEl || rowElements.has(rowEl)) return;
    rowElements.add(rowEl);
    const match = DATE_TIME.exec(row.text());
    if (match) {
      const [, d, m, y, hh, mm] = match;
      times.push({
        shown: match[0].replace(/\s+/g, " "),
        key: `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}T${hh!.padStart(2, "0")}:${mm}`,
      });
    }
  });

  times.sort((a, b) => a.key.localeCompare(b.key));
  const newest = times.at(-1);

  return {
    rows: rowElements.size,
    stations: stationKeys.size,
    columns: headingsOf($, links.first()),
    oldestMeasurement: times[0]?.shown ?? null,
    newestMeasurement: newest?.shown ?? null,
    newestMeasurementIso: newest ? withPragueOffset(newest.key) : null,
  };
}

function headingsOf($: cheerio.CheerioAPI, firstLink: ReturnType<cheerio.CheerioAPI>): string[] {
  const table = firstLink.closest("table");
  const headerRow = table
    .find("tr")
    .filter((_, tr) =>
      $(tr)
        .find("th")
        .toArray()
        .some((th) => $(th).text().trim() === "Nádrž"),
    )
    .first();
  // Column groups ("Zásobní prostor") span a second row of sub-headings ("zaplněný", "volný").
  const rows = headerRow.length ? [headerRow, headerRow.next("tr")] : [];
  return rows
    .flatMap((row) => row.find("th").toArray())
    .map((th) => $(th).text().replace(/\s+/g, " ").trim())
    .filter((text) => text !== "" && !UNIT_HEADING.test(text));
}

/** "2026-11-22T10:10" read as Europe/Prague wall-clock time, returned with its UTC offset. */
export function withPragueOffset(localIso: string): string {
  const asUtc = new Date(`${localIso}:00Z`);
  const offset = pragueOffsetMinutes(new Date(asUtc.getTime() - 60 * 60_000));
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${localIso}:00${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

function pragueOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Prague",
    timeZoneName: "longOffset",
  })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? "");
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}
