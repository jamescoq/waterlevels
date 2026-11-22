export type SourceCode = "pmo" | "pod" | "poh" | "pvl" | "pla";

export interface Source {
  code: SourceCode;
  /** Basin key used in station ids and the registry. */
  basin: "moravy" | "odry" | "ohre" | "vltavy" | "labe";
  /** Povodí name as shown on the site. */
  name: string;
  /** Reservoir portal root; page names are appended to it. */
  baseUrl: string;
  /**
   * Set when the daily scrape must not contact this source, with the reason. Its stations are
   * shown as "Bez dat". The probe still checks paused sources, to see when they can resume.
   */
  paused?: string;
}

/** Daily pages, relative to a source's baseUrl. */
export const DAILY_PAGES = {
  overview: "Prehled.aspx",
  volumes: "Objemy.aspx",
} as const;

export type DailyPage = keyof typeof DAILY_PAGES;

/*
 * Findings of the probe run from a Czech network on 2026-11-22 (tasks 2.1–2.3).
 *
 * All five portals run the same MGE Data software with the same three page types:
 *   Prehled.aspx                 overview: one row per station
 *   Objemy.aspx                  volumes: storage, controllable and uncontrollable retention,
 *                                each filled and free, in mil. m³ and %
 *   Mereni.aspx?id=<n>&oid=<n>   station detail, linked from every row; id + oid identify a
 *                                station (oid is the operating unit, 1–3)
 *
 * Measurements are near-real-time, not a single daily 07:00 value: at 10:39 the newest values
 * were 10:30 (Odra, Vltava, Labe), 10:00 (Ohře) and 09:00 (Moravy). Any daily run time works;
 * the 07:17 UTC schedule in design.md needs no change.
 *
 * Columns differ between portals, so parsers must map columns by heading, never by position:
 *   - "Odtok" (outflow) is only on the Odra and Vltava overview pages.
 *   - "Srážky (1h)" is on Moravy, Ohře and Labe only.
 *   - "Účel" (purpose) is on every portal except Vltava.
 *   Common: Nádrž, Tok, Datum, Hladina vody v nádrži, Objem, Přítok, Srážky (24h),
 *   Teplota vzduchu, Qa…Q100 (odtok), Poznámka. Volumes pages are identical everywhere.
 *
 * Every portal answers in about 2 s per page. Total: 118 stations.
 */
export const SOURCES: readonly Source[] = [
  {
    // robots.txt: none (404), so no rules apply.
    // 29 stations. Dalešice appears twice with different ids: "VD Dalešice" (id=14, oid=2) and
    // "VD Dalešice - přepočítaná" (id=29, oid=2); the registry maps only one of them.
    // Nové Mlýny is three stations: Horní, Střední and Dolní nádrž.
    // Newest values were 1.5 h old at probe time, so this portal updates less often.
    code: "pmo",
    basin: "moravy",
    name: "Povodí Moravy",
    baseUrl: "https://sap.pmo.cz/portal/Nadrze/cz/pc/",
  },
  {
    // robots.txt: blocks only named AI crawlers (GPTBot, ClaudeBot, …) and has no group for *
    // or for us, so no rules apply.
    // 7 stations.
    code: "pod",
    basin: "odry",
    name: "Povodí Odry",
    baseUrl: "https://www.pod.cz/portal/Nadrze/cz/pc/",
  },
  {
    // robots.txt: Cloudflare-managed; "User-agent: *" allows everything, with the content
    // signal "search=yes, ai-train=no, use=reference". We do not train models on the data.
    // 24 stations. The path uses lower-case "nadrze".
    // Blocked from GitHub-hosted runners: the probe on 2026-11-22 (run 45009512496) got 403
    // with a Cloudflare JavaScript challenge ("Just a moment…") for both pages, while a Czech
    // home network loads them normally. The challenge must not be circumvented. Paused until
    // Povodí Ohře lets stavvody.cz-bot through or offers a feed (design.md Decision 3, tasks 9.9).
    code: "poh",
    basin: "ohre",
    name: "Povodí Ohře",
    baseUrl: "https://sap.poh.cz/portal/nadrze/cz/pc/",
    paused: "Cloudflare bot challenge (403) for GitHub-hosted runners",
  },
  {
    // robots.txt: redirects to the site's 404 page, so no rules apply.
    // TLS: the server sends the wrong intermediate certificate; Node needs
    // certs/intermediates.pem (see certs/README.md).
    // 42 stations. No "Účel" column.
    code: "pvl",
    basin: "vltavy",
    name: "Povodí Vltavy",
    baseUrl: "https://www.pvl.cz/portal/Nadrze/cz/pc/",
  },
  {
    // Reservoir portal found by the probe at the same path pattern as the others.
    // robots.txt: "User-agent: *" with an empty Disallow, so everything is allowed.
    // 16 stations. The path uses lower-case "nadrze".
    code: "pla",
    basin: "labe",
    name: "Povodí Labe",
    baseUrl: "https://www.pla.cz/portal/nadrze/cz/pc/",
  },
];
