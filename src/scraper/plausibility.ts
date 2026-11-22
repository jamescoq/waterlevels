/**
 * Implausible values (water-data-collection spec, "Implausible values"): a value outside
 * physical bounds is stored as missing with a warning, and the run continues.
 */
import { NOT_DEFINED } from "../shared/czech.ts";
import type { Zone, ZoneKey } from "./portals/mge.ts";

/** A level more than this far below the permanent pool is implausible. */
export const MAX_DEPTH_BELOW_PERMANENT_M = 20;
/** A level more than this far above the dam crest is implausible. */
export const MAX_HEIGHT_ABOVE_CREST_M = 2;
export const MIN_PERCENT = 0;
export const MAX_PERCENT = 150;

export interface StationValues {
  level: number | null;
  zones: Record<ZoneKey, Zone>;
}

export interface StationContext {
  name: string;
  /** From the station registry, m a.s.l.; null where not known. */
  levels: { crest: number | null; permanent: number | null };
  /** An entry in overrides.json covers today; the reservoir may be emptied for repairs. */
  plannedDrawdownActive: boolean;
}

export interface CheckedValues extends StationValues {
  warnings: string[];
}

export function checkPlausibility(values: StationValues, station: StationContext): CheckedValues {
  const warnings: string[] = [];
  let level = values.level;

  if (level !== null) {
    const { crest, permanent } = station.levels;
    if (crest !== null && level > crest + MAX_HEIGHT_ABOVE_CREST_M) {
      warnings.push(
        `${station.name}: level ${level} m is more than ${MAX_HEIGHT_ABOVE_CREST_M} m above the crest (${crest} m)`,
      );
      level = null;
    } else if (
      permanent !== null &&
      !station.plannedDrawdownActive &&
      level < permanent - MAX_DEPTH_BELOW_PERMANENT_M
    ) {
      warnings.push(
        `${station.name}: level ${level} m is more than ${MAX_DEPTH_BELOW_PERMANENT_M} m below the permanent pool (${permanent} m)`,
      );
      level = null;
    }
  }

  const zones = {} as Record<ZoneKey, Zone>;
  for (const [key, zone] of Object.entries(values.zones) as [ZoneKey, Zone][]) {
    if (zone === NOT_DEFINED) {
      zones[key] = zone;
      continue;
    }
    const percent = (part: "filledPct" | "freePct"): number | null => {
      const value = zone[part];
      if (value === null || (value >= MIN_PERCENT && value <= MAX_PERCENT)) return value;
      warnings.push(
        `${station.name}: ${key} ${part} ${value} % is outside ${MIN_PERCENT}–${MAX_PERCENT} %`,
      );
      return null;
    };
    zones[key] = { ...zone, filledPct: percent("filledPct"), freePct: percent("freePct") };
  }

  return { level, zones, warnings };
}
