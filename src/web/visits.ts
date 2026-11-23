/**
 * Cookieless visit counting with GoatCounter (visit-statistics spec; design.md Decision 12).
 *
 * Instead of loading GoatCounter's count.js, this sends the one request it would send, to the
 * documented /count endpoint. Nothing is stored on the device. It runs only on the production
 * host, only when a GoatCounter site is configured at build time (VITE_GOATCOUNTER_HOST, e.g.
 * "stavvody.goatcounter.com"), and never throws.
 */
import { STATION_PARAM } from "./data.ts";

export const PRODUCTION_HOST = "stavvody.cz";

export interface VisitEnvironment {
  counterHost: string | undefined;
  hostname: string;
  search: string;
  referrer: string;
  title: string;
  screen: { width: number; height: number; ratio: number };
  /** Sends the request; navigator.sendBeacon in the browser. */
  send: (url: string) => void;
}

/** The count URL for this page load, or null when nothing should be counted. */
export function visitUrl(env: Omit<VisitEnvironment, "send">): string | null {
  if (!env.counterHost || env.hostname !== PRODUCTION_HOST) return null;
  // One visit per page load; a visit through a shared link records its station.
  const station = new URLSearchParams(env.search).get(STATION_PARAM);
  const path = station ? `/?${STATION_PARAM}=${encodeURIComponent(station)}` : "/";
  const params = new URLSearchParams({
    p: path,
    t: env.title,
    r: env.referrer,
    s: `${env.screen.width},${env.screen.height},${env.screen.ratio}`,
    b: "0",
    rnd: Math.random().toString(36).slice(2, 8),
  });
  return `https://${env.counterHost}/count?${params}`;
}

/** Reports the page load once; returns whether a request was sent. */
export function countVisit(env: VisitEnvironment): boolean {
  try {
    const url = visitUrl(env);
    if (!url) return false;
    env.send(url);
    return true;
  } catch {
    // Counting must never affect the site.
    return false;
  }
}

/** Browser wiring: called once, after the page has rendered. */
export function countThisVisit(): void {
  const run = () =>
    countVisit({
      counterHost: import.meta.env.VITE_GOATCOUNTER_HOST as string | undefined,
      hostname: location.hostname,
      search: location.search,
      referrer: document.referrer,
      title: document.title,
      screen: { width: screen.width, height: screen.height, ratio: devicePixelRatio || 1 },
      send: (url) => {
        if (!navigator.sendBeacon?.(url)) {
          fetch(url, { mode: "no-cors", keepalive: true, credentials: "omit" }).catch(() => {});
        }
      },
    });
  if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 3000 });
  else setTimeout(run, 1000);
}
