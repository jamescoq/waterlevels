/**
 * Development data: builds public/data/latest.json from the saved portal pages in
 * test/fixtures, as if collected on 2026-11-22, with a synthetic previous day so the change
 * since yesterday shows. For local development only; the deploy builds latest.json from the
 * data branch and overwrites this file.
 *
 *   pnpm dev:data
 *
 * The fixtures are from 2026-11-22, so the browser would show everything as "Bez dat" once
 * 36 hours have passed. In development, open the site with ?ted=2026-11-22T12:00 to set the
 * page's clock.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildLatest } from "../src/derive/latest.ts";
import { collect, type PageFetcher } from "../src/scraper/collect.ts";
import { loadRegistry } from "../src/scraper/output.ts";
import { SOURCES } from "../src/scraper/sources.ts";
import type { Snapshot } from "../src/shared/snapshot.ts";

const now = new Date("2026-11-22T11:00:00+01:00");

const fixtures: PageFetcher = {
  async get(url) {
    const source = SOURCES.find((s) => url.startsWith(new URL("/", s.baseUrl).href))!;
    const page = url.endsWith("Prehled.aspx")
      ? "overview"
      : url.endsWith("Objemy.aspx")
        ? "volumes"
        : null;
    const body = page
      ? await readFile(join("test/fixtures", source.code, `${page}.html`), "utf8")
      : "";
    return {
      url,
      finalUrl: url,
      status: page ? 200 : 404,
      body,
      error: null,
      attempts: 1,
      durationMs: 0,
    };
  },
};

const { registry, overrides } = await loadRegistry();
const result = await collect({
  fetcher: fixtures,
  registry,
  overrides,
  now,
  sleep: async () => {},
});
if (!result.ok) throw new Error(result.reason);
const today = result.snapshot;

/** The same day 24 h earlier, with levels a few cm different, so changes show. */
const shift = (iso: string | null) =>
  iso === null
    ? null
    : new Date(Date.parse(iso) - 24 * 3600_000).toISOString().replace(".000Z", "+00:00");
const yesterday: Snapshot = {
  ...today,
  date: "2026-11-21",
  fetchedAt: new Date(Date.parse(today.fetchedAt) - 24 * 3600_000).toISOString(),
  stations: Object.fromEntries(
    Object.entries(today.stations).map(([id, s], i) => [
      id,
      {
        ...s,
        measuredAt: shift(s.measuredAt),
        level: s.level === null ? null : Math.round((s.level - ((i % 7) - 3) * 0.04) * 100) / 100,
      },
    ]),
  ),
};

const latest = buildLatest({ registry, overrides, snapshots: [yesterday, today], now });
await mkdir("public/data", { recursive: true });
await writeFile("public/data/latest.json", JSON.stringify(latest));
console.log(
  `public/data/latest.json: ${latest.stations.length} stations (development data from fixtures)`,
);
