/**
 * Parsers for the MGE Data reservoir portal used by all five Povodí: the overview page
 * (Prehled.aspx) and the volumes page (Objemy.aspx).
 *
 * Columns are found by their header text, never by position, because the portals publish
 * different column sets (outflow, 1-hour precipitation and purpose are each missing somewhere).
 * Any header or cell the parser does not understand throws a LayoutError, so a portal redesign
 * fails loudly instead of producing wrong numbers.
 */
import * as cheerio from "cheerio";
import { NOT_DEFINED, parsePragueDateTime, parseZoneCell } from "../../shared/czech.ts";

export class LayoutError extends Error {
  override name = "LayoutError";
}

export interface PortalId {
  id: string;
  oid: string;
}

export const FLOOD_KEYS = ["Qa", "Q1", "Q5", "Q20", "Q100"] as const;
export type FloodKey = (typeof FLOOD_KEYS)[number];

type NumberField =
  | "level"
  | "volume"
  | "inflow"
  | "outflow"
  | "precipitation1h"
  | "precipitation24h"
  | "airTemperature";

export interface OverviewRow {
  portalId: PortalId;
  name: string;
  river: string;
  /** "Účel" as published, e.g. "Vodárenská"; null where the portal has no such column. */
  purpose: string | null;
  /** Prague time with offset; null when the cell is blank. */
  measuredAt: string | null;
  /** m a.s.l. */
  level: number | null;
  /** mil. m³ */
  volume: number | null;
  /** m³/s; null when not measured or not published by this portal. */
  inflow: number | null;
  outflow: number | null;
  /** mm */
  precipitation1h: number | null;
  precipitation24h: number | null;
  /** °C */
  airTemperature: number | null;
  /** Outflow flood thresholds in m³/s; null when the portal gives none for this station. */
  floodThresholds: Partial<Record<FloodKey, number>> | null;
  /** Portal note, verbatim; empty when there is none. */
  note: string;
}

export type ZoneKey = "storage" | "retentionControllable" | "retentionUncontrollable";

export type Zone =
  | typeof NOT_DEFINED
  | {
      filled: number | null;
      filledPct: number | null;
      free: number | null;
      freePct: number | null;
    };

export interface VolumesRow {
  portalId: PortalId;
  name: string;
  measuredAt: string | null;
  storage: Zone;
  retentionControllable: Zone;
  retentionUncontrollable: Zone;
}

type ZonePart = "filled" | "filledPct" | "free" | "freePct";

type Column =
  | { kind: "name" }
  | { kind: "river" }
  | { kind: "purpose" }
  | { kind: "measuredAt" }
  | { kind: "note" }
  | { kind: "number"; field: NumberField }
  | { kind: "flood"; key: FloodKey }
  | { kind: "zone"; zone: ZoneKey; part: ZonePart };

const SIMPLE_HEADINGS: Record<string, Column> = {
  Nádrž: { kind: "name" },
  Tok: { kind: "river" },
  Účel: { kind: "purpose" },
  Datum: { kind: "measuredAt" },
  Poznámka: { kind: "note" },
  "Hladina vody v nádrži": { kind: "number", field: "level" },
  Objem: { kind: "number", field: "volume" },
  Přítok: { kind: "number", field: "inflow" },
  Odtok: { kind: "number", field: "outflow" },
  "Srážky (1h)": { kind: "number", field: "precipitation1h" },
  "Srážky (24h)": { kind: "number", field: "precipitation24h" },
  "Teplota vzduchu": { kind: "number", field: "airTemperature" },
};

const ZONE_HEADINGS: Record<string, ZoneKey> = {
  "Zásobní prostor": "storage",
  "Ovladatelný retenční prostor": "retentionControllable",
  "Neovladatelný retenční prostor": "retentionUncontrollable",
};

const FLOOD_HEADING = /^(Qa|Q1|Q5|Q20|Q100) \(odtok\)$/;

const clean = (text: string) => text.replace(/[\s\u00a0]+/g, " ").trim();

interface Table {
  columns: Column[];
  rows: { portalId: PortalId; name: string; cells: string[] }[];
}

function readTable(html: string): Table {
  const $ = cheerio.load(html);
  const links = $('a[href*="Mereni.aspx"]');
  if (links.length === 0) return { columns: [], rows: [] };
  const table = links.first().closest("table");

  const headerRow = table
    .find("tr")
    .filter((_, tr) =>
      $(tr)
        .children("th")
        .toArray()
        .some((th) => clean($(th).text()) === "Nádrž"),
    )
    .first();
  if (headerRow.length === 0) throw new LayoutError('no header row with "Nádrž"');

  // Expand the first two header rows into one label path per column, honouring row and
  // column spans. The third header row (units) does not line up with the columns on the
  // volumes page, so it is not used.
  const paths: { labels: string[]; offset: number }[] = [];
  const takenInSecondRow = new Set<number>();
  for (const th of headerRow.children("th").toArray()) {
    const span = Number($(th).attr("colspan") ?? 1);
    const rowspan = Number($(th).attr("rowspan") ?? 1);
    const label = clean($(th).text());
    for (let i = 0; i < span; i++) {
      if (rowspan > 1) takenInSecondRow.add(paths.length);
      paths.push({ labels: [label], offset: i });
    }
  }
  let column = 0;
  for (const th of headerRow.next("tr").children("th").toArray()) {
    while (takenInSecondRow.has(column)) column++;
    const span = Number($(th).attr("colspan") ?? 1);
    for (let i = 0; i < span && column < paths.length; i++, column++) {
      const path = paths[column]!;
      path.labels.push(clean($(th).text()));
      path.offset = i;
    }
  }

  const columns = paths.map(toColumn);
  const keys = columns.map((c) => JSON.stringify(c));
  const duplicate = keys.find((k, i) => keys.indexOf(k) !== i);
  if (duplicate) throw new LayoutError(`column appears twice: ${duplicate}`);

  const rows: Table["rows"] = [];
  table.find("tr").each((_, tr) => {
    const link = $(tr).find('a[href*="Mereni.aspx"]').first();
    if (link.length === 0) return;
    const name = clean(link.text());
    const cells = $(tr)
      .children("td")
      .toArray()
      .map((td) => clean($(td).text()));
    if (cells.length !== columns.length) {
      throw new LayoutError(`${name}: ${cells.length} cells for ${columns.length} columns`);
    }
    rows.push({ portalId: portalIdOf(link.attr("href") ?? "", name), name, cells });
  });
  return { columns, rows };
}

function toColumn(path: { labels: string[]; offset: number }): Column {
  const [heading = "", sub = ""] = path.labels;
  const simple = SIMPLE_HEADINGS[heading];
  if (simple) return simple;
  const flood = FLOOD_HEADING.exec(heading);
  if (flood) return { kind: "flood", key: flood[1] as FloodKey };
  const zone = ZONE_HEADINGS[heading];
  if (zone) {
    const base = sub === "zaplněný" ? "filled" : sub === "volný" ? "free" : null;
    if (!base) throw new LayoutError(`unknown sub-heading "${sub}" under "${heading}"`);
    // Each sub-heading spans two columns: mil. m³, then %.
    return { kind: "zone", zone, part: path.offset === 0 ? base : `${base}Pct` };
  }
  throw new LayoutError(`unknown column heading "${heading}"`);
}

function portalIdOf(href: string, name: string): PortalId {
  const params = new URLSearchParams(href.split("?")[1] ?? "");
  const id = params.get("id");
  const oid = params.get("oid");
  if (!id || !oid) throw new LayoutError(`${name}: detail link without id and oid: ${href}`);
  return { id, oid };
}

function requireColumns(columns: Column[], kinds: Column["kind"][], page: string): void {
  for (const kind of kinds) {
    if (!columns.some((c) => c.kind === kind)) throw new LayoutError(`${page}: no ${kind} column`);
  }
}

function cellError(name: string, column: Column, err: unknown): LayoutError {
  const what = "field" in column ? column.field : "key" in column ? column.key : column.kind;
  return new LayoutError(`${name}, ${what}: ${err instanceof Error ? err.message : String(err)}`);
}

/** Parses Prehled.aspx. A page without station rows yields an empty list. */
export function parseOverview(html: string): OverviewRow[] {
  const { columns, rows } = readTable(html);
  if (rows.length === 0) return [];
  requireColumns(columns, ["name", "measuredAt"], "overview");
  if (!columns.some((c) => c.kind === "number" && c.field === "level")) {
    throw new LayoutError("overview: no level column");
  }

  return rows.map(({ portalId, name, cells }) => {
    const row: OverviewRow = {
      portalId,
      name,
      river: "",
      purpose: null,
      measuredAt: null,
      level: null,
      volume: null,
      inflow: null,
      outflow: null,
      precipitation1h: null,
      precipitation24h: null,
      airTemperature: null,
      floodThresholds: null,
      note: "",
    };
    const flood: Partial<Record<FloodKey, number>> = {};
    columns.forEach((column, i) => {
      const text = cells[i] ?? "";
      try {
        switch (column.kind) {
          case "river":
            row.river = text;
            break;
          case "purpose":
            row.purpose = text === "" ? null : text;
            break;
          case "measuredAt":
            row.measuredAt = parsePragueDateTime(text);
            break;
          case "note":
            // Povodí Odry fills the note column with the station name.
            row.note = text === name ? "" : text;
            break;
          case "number":
            row[column.field] = numberOrNull(text);
            break;
          case "flood": {
            const value = numberOrNull(text);
            if (value !== null) flood[column.key] = value;
            break;
          }
          default:
            break;
        }
      } catch (err) {
        throw cellError(name, column, err);
      }
    });
    row.floodThresholds = Object.keys(flood).length > 0 ? flood : null;
    return row;
  });
}

/** Parses Objemy.aspx. A page without station rows yields an empty list. */
export function parseVolumes(html: string): VolumesRow[] {
  const { columns, rows } = readTable(html);
  if (rows.length === 0) return [];
  requireColumns(columns, ["name", "measuredAt"], "volumes");
  for (const zone of Object.values(ZONE_HEADINGS)) {
    for (const part of ["filled", "filledPct", "free", "freePct"] as const) {
      if (!columns.some((c) => c.kind === "zone" && c.zone === zone && c.part === part)) {
        throw new LayoutError(`volumes: no ${zone} ${part} column`);
      }
    }
  }

  return rows.map(({ portalId, name, cells }) => {
    const parts = new Map<ZoneKey, Partial<Record<ZonePart, ReturnType<typeof parseZoneCell>>>>();
    let measuredAt: string | null = null;
    columns.forEach((column, i) => {
      const text = cells[i] ?? "";
      try {
        if (column.kind === "measuredAt") measuredAt = parsePragueDateTime(text);
        if (column.kind === "zone") {
          const zone = parts.get(column.zone) ?? {};
          zone[column.part] = parseZoneCell(text);
          parts.set(column.zone, zone);
        }
      } catch (err) {
        throw cellError(name, column, err);
      }
    });
    const zoneOf = (key: ZoneKey): Zone => toZone(parts.get(key) ?? {});
    return {
      portalId,
      name,
      measuredAt,
      storage: zoneOf("storage"),
      retentionControllable: zoneOf("retentionControllable"),
      retentionUncontrollable: zoneOf("retentionUncontrollable"),
    };
  });
}

/**
 * A zone is "not defined" when its cells hold dashes and no numbers. Povodí Labe dashes only
 * the mil. m³ cells and leaves the % cells blank, so "all four are dashes" is not the rule.
 */
function toZone(cells: Partial<Record<ZonePart, ReturnType<typeof parseZoneCell>>>): Zone {
  const values = Object.values(cells);
  const hasDash = values.includes(NOT_DEFINED);
  const hasNumber = values.some((v) => typeof v === "number");
  if (hasDash && !hasNumber) return NOT_DEFINED;
  const num = (v: ReturnType<typeof parseZoneCell> | undefined) =>
    typeof v === "number" ? v : null;
  return {
    filled: num(cells.filled),
    filledPct: num(cells.filledPct),
    free: num(cells.free),
    freePct: num(cells.freePct),
  };
}

/** Overview cells: a dash means no value, the same as a blank cell. */
function numberOrNull(text: string): number | null {
  const value = parseZoneCell(text);
  return value === NOT_DEFINED ? null : value;
}
