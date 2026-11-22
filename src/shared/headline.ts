/**
 * National headline and status counts (national-summary spec). Computed in the browser from
 * the statuses the visitor sees, so it follows the 36-hour rule.
 */
import { RATED, STATUSES, isStale, type Status } from "./status.ts";

export interface HeadlineStation {
  status: Status;
  /** Filled storage volume today, mil. m³. */
  storageFilled: number | null;
  /** Storage capacity today (filled + free), mil. m³. */
  storageCapacity: number | null;
}

export interface Headline {
  /** All shown stations. */
  total: number;
  /** "Nad zásobní hladinou" + "Vysoká zásoba". */
  high: number;
  /** Stations with a fill rating. */
  rated: number;
  /** "Bez dat" + "Plánované snížení" + "Jen hladina". */
  outsideRating: number;
  statusCounts: Record<Status, number>;
  /** Σ filled / Σ capacity over rated stations, whole percent; null when nothing qualifies. */
  weightedFillPct: number | null;
}

export function computeHeadline(stations: HeadlineStation[]): Headline {
  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  let filled = 0;
  let capacity = 0;
  for (const station of stations) {
    statusCounts[station.status]++;
    if (
      RATED.includes(station.status) &&
      station.storageFilled !== null &&
      station.storageCapacity !== null &&
      station.storageCapacity > 0
    ) {
      filled += station.storageFilled;
      capacity += station.storageCapacity;
    }
  }
  const rated = RATED.reduce((n, s) => n + statusCounts[s], 0);
  return {
    total: stations.length,
    high: statusCounts["above-storage"] + statusCounts.high,
    rated,
    outsideRating: stations.length - rated,
    statusCounts,
    weightedFillPct: capacity > 0 ? Math.round((filled / capacity) * 100) : null,
  };
}

/** The hero's two sentences in Czech, as the spec words them. */
export function headlineText(headline: Headline): { main: string; weighted: string | null } {
  if (headline.rated === 0) return { main: "Aktuální data nejsou k dispozici.", weighted: null };
  return {
    main: `V ${headline.high} z ${headline.total} nádrží je zásoba vody nad 70 %`,
    weighted:
      headline.weightedFillPct === null
        ? null
        : `Souhrnná naplněnost zásobních prostorů je ${headline.weightedFillPct} %.`,
  };
}

/** The status a visitor sees: the build's status, or "Bez dat" once the data is 36 h old. */
export function visibleStatus(buildStatus: Status, measuredAt: string | null, now: Date): Status {
  return isStale(measuredAt, now) ? "no-data" : buildStatus;
}
