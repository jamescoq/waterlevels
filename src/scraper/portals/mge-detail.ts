/**
 * Parser for the MGE portal station detail page (Mereni.aspx?id=…&oid=…). Used only when the
 * station registry is built or refreshed, never by the daily run.
 */
import * as cheerio from "cheerio";
import { parseCzechNumber } from "../../shared/czech.ts";
import { LayoutError } from "./mge.ts";

export interface DetailLevels {
  /** Koruna hráze */
  crest: number | null;
  /** Kóta přelivu */
  spillway: number | null;
  /** Maximální retenční hladina */
  maxRetention: number | null;
  /** Hladina zásobního prostoru: top of the storage zone */
  storage: number | null;
  /** Hladina stálého nadržení: permanent pool */
  permanent: number | null;
}

export interface StationDetail {
  river: string;
  /** "Účel" as published; null where the portal does not give it. */
  purpose: string | null;
  /** m a.s.l. */
  levels: DetailLevels;
  /** "Výškový systém", e.g. "Balt p.v."; null when not given. */
  heightDatum: string | null;
  note: string;
}

const LEVEL_LABELS: Record<string, keyof DetailLevels> = {
  "Koruna hráze:": "crest",
  "Kóta přelivu:": "spillway",
  "Maximální retenční hladina:": "maxRetention",
  "Hladina zásobního prostoru:": "storage",
  "Hladina stálého nadržení:": "permanent",
};

const clean = (text: string) => text.replace(/[\s\u00a0]+/g, " ").trim();

/** Reads the station's info table: one row per label, value in the next cell. */
export function parseDetail(html: string, stationName: string): StationDetail {
  const $ = cheerio.load(html);
  const values = new Map<string, string>();
  $("tr").each((_, tr) => {
    const cells = $(tr).children("td");
    if (cells.length !== 2) return;
    const label = clean(cells.eq(0).text());
    if (label.endsWith(":")) values.set(label, clean(cells.eq(1).text()));
  });

  if (!values.has("Tok:") || !values.has("Koruna hráze:")) {
    throw new LayoutError(`${stationName}: detail page has no station info table`);
  }

  const levels = {
    crest: null,
    spillway: null,
    maxRetention: null,
    storage: null,
    permanent: null,
  } as DetailLevels;
  for (const [label, key] of Object.entries(LEVEL_LABELS)) {
    const text = (values.get(label) ?? "").replace(/\[m n\.m\.\]/, "").trim();
    try {
      levels[key] = parseCzechNumber(text);
    } catch (err) {
      throw new LayoutError(
        `${stationName}, ${key}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const note = values.get("Poznámka:") ?? "";
  return {
    river: values.get("Tok:") ?? "",
    purpose: values.get("Účel:") || null,
    levels,
    heightDatum: values.get("Výškový systém:") || null,
    // Povodí Odry repeats the station name in the note.
    note: note === stationName ? "" : note,
  };
}
