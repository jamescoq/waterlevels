import type { Latest } from "../shared/latest.ts";

/** Query parameter of a shared station link (station-detail spec, "Shareable link"). */
export const STATION_PARAM = "stanice";

/**
 * The page's clock. In development, ?ted=2026-11-22T12:00 sets it, so the fixture data (from
 * 22 November 2026) does not turn into "Bez dat" after 36 hours.
 */
export function pageNow(): Date {
  if (import.meta.env.DEV) {
    const ted = new URLSearchParams(location.search).get("ted");
    if (ted && !Number.isNaN(Date.parse(ted))) return new Date(ted);
  }
  return new Date();
}

/** latest.json, with the build id so a new deploy is fetched despite the 10-minute cache. */
export async function loadLatest(fetchImpl: typeof fetch = fetch): Promise<Latest> {
  const response = await fetchImpl(`/data/latest.json?v=${__BUILD_ID__}`);
  if (!response.ok) throw new Error(`latest.json: HTTP ${response.status}`);
  return (await response.json()) as Latest;
}
