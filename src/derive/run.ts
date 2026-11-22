/**
 * Derive step of the site build (tasks 6.4).
 *
 *   pnpm derive [--data-dir data] [--out public/data/latest.json]
 *
 * Reads the registry, the overrides and the last 31 snapshots from the data-branch checkout,
 * and writes latest.json. Works with no snapshots at all (before the first collection): every
 * station is then "Bez dat".
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { gzipSync } from "node:zlib";
import { buildLatest } from "./latest.ts";
import { readRecentSnapshots } from "../scraper/alerts.ts";
import { loadRegistry } from "../scraper/output.ts";

/** Enough history for last known values and the change since yesterday. */
const SNAPSHOT_DAYS = 31;

const arg = (flag: string, fallback: string) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};
const dataDir = arg("--data-dir", "data");
const out = arg("--out", "public/data/latest.json");

const { registry, overrides } = await loadRegistry();
const snapshots = await readRecentSnapshots(dataDir, SNAPSHOT_DAYS);
const latest = buildLatest({ registry, overrides, snapshots, now: new Date() });

const json = JSON.stringify(latest);
await mkdir(dirname(out), { recursive: true });
await writeFile(out, json);

const unplaced = latest.stations.filter((s) => s.desktop === null).length;
console.log(
  `${out}: ${latest.stations.length} stations from ${snapshots.length} snapshots, ` +
    `${Math.round(json.length / 1024)} KB (${Math.round(gzipSync(json).length / 1024)} KB gzipped)` +
    (unplaced ? `; ${unplaced} without map position` : ""),
);
