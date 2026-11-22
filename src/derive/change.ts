/**
 * Change since yesterday (station-status spec, "Change since yesterday" and "Trend source").
 * Measured levels only; inflow minus outflow is never used.
 */

export interface Measurement {
  measuredAt: string | null;
  level: number | null;
}

const HOUR = 3600_000;
export const WINDOW_FROM_HOURS = 18;
export const WINDOW_TO_HOURS = 30;

/**
 * Level change in whole centimetres, 0 for under 1 cm either way, or null when unknown.
 *
 * @param current  the station in the latest snapshot
 * @param previous the station in the snapshot before it, if any
 * @param earlier  the station in every earlier snapshot, in any order
 */
export function changeSinceYesterday(
  current: Measurement,
  previous: Measurement | undefined,
  earlier: Measurement[],
): number | null {
  if (current.level === null || current.measuredAt === null) return null;
  const now = Date.parse(current.measuredAt);

  // The portal did not update: today's value is not newer than yesterday's.
  if (previous?.measuredAt && Date.parse(previous.measuredAt) >= now) return null;

  let best: { level: number; distance: number } | null = null;
  for (const m of earlier) {
    if (m.level === null || m.measuredAt === null) continue;
    const age = now - Date.parse(m.measuredAt);
    if (age < WINDOW_FROM_HOURS * HOUR || age > WINDOW_TO_HOURS * HOUR) continue;
    const distance = Math.abs(age - 24 * HOUR);
    if (!best || distance < best.distance) best = { level: m.level, distance };
  }
  if (!best) return null;

  const cm = (current.level - best.level) * 100;
  return Math.abs(cm) < 1 ? 0 : Math.round(cm);
}
