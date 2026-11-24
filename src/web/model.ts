/** View model: what the page shows, derived from latest.json and the page's clock. */
import { formatDate } from "./format.ts";
import { computeHeadline, visibleStatus, type Headline } from "../shared/headline.ts";
import type { Latest, LatestStation } from "../shared/latest.ts";
import { STATUS_LABELS, type Status } from "../shared/status.ts";

export interface StatusStyle {
  color: string;
  /** "183, 156, 255" for rgba() */
  rgb: string;
}

/** Status colours (station-map spec; design brief §1). */
export const STATUS_STYLE: Record<Status, StatusStyle> = {
  "above-storage": { color: "#B79CFF", rgb: "183, 156, 255" },
  high: { color: "#3DB9F2", rgb: "61, 185, 242" },
  medium: { color: "#F4B740", rgb: "244, 183, 64" },
  low: { color: "#FF6E6E", rgb: "255, 110, 110" },
  planned: { color: "#B4C3D6", rgb: "180, 195, 214" },
  "no-data": { color: "#7A8BA0", rgb: "122, 139, 160" },
  "level-only": { color: "#A9BCD2", rgb: "169, 188, 210" },
};

/** CSS custom properties for a status colour. */
export const statusVars = (status: Status) => ({
  "--c": STATUS_STYLE[status].color,
  "--rgb": STATUS_STYLE[status].rgb,
});

export const statusLabel = (status: Status) => STATUS_LABELS[status];
export const statusLower = (status: Status) =>
  STATUS_LABELS[status].charAt(0).toLowerCase() + STATUS_LABELS[status].slice(1);

export interface ViewStation extends LatestStation {
  /** Status the visitor sees: the build's, or "Bez dat" once the data is 36 h old. */
  status: Status;
}

export interface Group {
  basin: LatestStation["basin"];
  title: string;
  stations: ViewStation[];
}

export interface View {
  stations: ViewStation[];
  byId: Map<string, ViewStation>;
  groups: Group[];
  headline: Headline;
  lastSuccessfulFetch: string | null;
  /** The newest data is older than 36 hours. */
  stale: boolean;
}

/** List order of the Povodí (design brief §4). */
const BASIN_ORDER: LatestStation["basin"][] = ["vltavy", "labe", "ohre", "moravy", "odry"];

export function buildView(latest: Latest, now: Date): View {
  const stations = latest.stations.map((s): ViewStation => ({
    ...s,
    status: visibleStatus(s.buildStatus, s.measuredAt, now),
  }));
  const groups = BASIN_ORDER.map((basin) => {
    const inBasin = stations
      .filter((s) => s.basin === basin)
      .sort((a, b) => a.name.localeCompare(b.name, "cs"));
    return { basin, title: inBasin[0]?.sourceName ?? "", stations: inBasin };
  }).filter((g) => g.stations.length > 0);

  const stale =
    latest.lastSuccessfulFetch === null ||
    now.getTime() - Date.parse(latest.lastSuccessfulFetch) > 36 * 3600_000;

  return {
    stations,
    byId: new Map(stations.map((s) => [s.id, s])),
    groups,
    headline: computeHeadline(stations),
    lastSuccessfulFetch: latest.lastSuccessfulFetch,
    stale,
  };
}

/** Fill as the list and map show it: a percentage only for rated statuses. */
export function shownFill(station: ViewStation): number | null {
  return station.status === "no-data" || station.status === "level-only"
    ? null
    : station.fillPctRaw;
}

/** Explanation for stations outside the rating (station-detail spec, "Note for stations outside the rating"). */
export function noteFor(station: ViewStation): string | null {
  switch (station.status) {
    case "planned":
      return `${station.overrideReason ?? "Správce hladinu snížil záměrně"}. Nejde o projev sucha.`.replace(
        "..",
        ".",
      );
    case "level-only":
      return station.levelOnlyReason === "no-zone"
        ? "Tato nádrž nemá vymezený zásobní prostor, proto u ní neuvádíme naplnění."
        : "Povodí u této nádrže naplnění neuvádí.";
    case "no-data":
      if (station.sourceStatus === "paused") {
        return `Data z ${station.sourceName} zatím nestahujeme. Aktuální stav najdete na webu Povodí.`;
      }
      return station.measuredAt
        ? `Dnešní měření se nepodařilo načíst. Poslední známé hodnoty jsou z ${formatDate(station.measuredAt)}.`
        : "Povodí pro tuto nádrž dnes nezveřejnilo žádné měření.";
    default:
      return null;
  }
}

/** Accessible name of a station's circle or row. */
export function stationAria(station: ViewStation): string {
  const fill = shownFill(station);
  if (fill === null) return `${station.name}: ${statusLower(station.status)}`;
  return `${station.name}: ${Math.round(fill)} % zásobního prostoru, ${statusLower(station.status)}`;
}
