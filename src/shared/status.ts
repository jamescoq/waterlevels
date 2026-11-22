/**
 * Station status rules (station-status spec). Shared by the build, which derives each
 * station's status, and the browser, which re-applies the 36-hour rule against its own clock.
 */
import type { SourceStatus } from "./snapshot.ts";

export const STATUSES = [
  "no-data",
  "planned",
  "above-storage",
  "level-only",
  "high",
  "medium",
  "low",
] as const;
export type Status = (typeof STATUSES)[number];

/** Czech labels, as on screen. */
export const STATUS_LABELS: Record<Status, string> = {
  "no-data": "Bez dat",
  planned: "Plánované snížení",
  "above-storage": "Nad zásobní hladinou",
  "level-only": "Jen hladina",
  high: "Vysoká zásoba",
  medium: "Střední zásoba",
  low: "Nízká zásoba",
};

/** Statuses with a fill rating; the rest count as "mimo hodnocení". */
export const RATED: readonly Status[] = ["above-storage", "high", "medium", "low"];

export const HIGH_THRESHOLD_PCT = 70;
export const MEDIUM_THRESHOLD_PCT = 40;
export const STALE_AFTER_HOURS = 36;

export type LevelOnlyReason = "no-zone" | "fill-not-published";

export interface StatusInput {
  /** Status of the station's source in the latest snapshot. */
  sourceStatus: SourceStatus;
  /** Latest measurement time (ISO with offset), null when there is none. */
  measuredAt: string | null;
  level: number | null;
  /** Top of the storage zone, m a.s.l.; null when the portal gives none. */
  storageLevel: number | null;
  /** Storage zone: not defined for this dam, or its published fill in % (null when blank). */
  storage: "undefined-zone" | { filledPct: number | null };
  /** Filled controllable plus uncontrollable retention, mil. m³; null when not measured. */
  retentionFilled: number | null;
  /** An owner's planned-drawdown entry covers today. */
  plannedDrawdownActive: boolean;
}

export interface StatusResult {
  status: Status;
  levelOnlyReason: LevelOnlyReason | null;
}

/** Applies the rules in the spec's order; the first that matches wins. */
export function deriveStatus(input: StatusInput, now: Date): StatusResult {
  const result = (status: Status, levelOnlyReason: LevelOnlyReason | null = null) => ({
    status,
    levelOnlyReason,
  });
  const fillPct = input.storage === "undefined-zone" ? null : input.storage.filledPct;

  // 1. Bez dat
  if (input.sourceStatus !== "ok" || isStale(input.measuredAt, now)) return result("no-data");
  if (input.level === null && fillPct === null) return result("no-data");

  // 2. Plánované snížení
  if (input.plannedDrawdownActive) return result("planned");

  // 3. Nad zásobní hladinou
  if (
    (input.retentionFilled ?? 0) > 0 ||
    (input.level !== null && input.storageLevel !== null && input.level > input.storageLevel) ||
    (fillPct !== null && fillPct > 100)
  ) {
    return result("above-storage");
  }

  // 4. Jen hladina
  if (input.storage === "undefined-zone") return result("level-only", "no-zone");
  if (fillPct === null) return result("level-only", "fill-not-published");

  // 5.–7. fill rating
  if (fillPct >= HIGH_THRESHOLD_PCT) return result("high");
  if (fillPct >= MEDIUM_THRESHOLD_PCT) return result("medium");
  return result("low");
}

/** True when the measurement is missing or older than 36 hours at `now`. */
export function isStale(measuredAt: string | null, now: Date): boolean {
  if (measuredAt === null) return true;
  return now.getTime() - new Date(measuredAt).getTime() > STALE_AFTER_HOURS * 3600_000;
}
