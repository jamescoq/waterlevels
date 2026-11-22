/** Files the scrape writes into the data-branch checkout. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CollectResult } from "./collect.ts";
import {
  OverridesFileSchema,
  StationsFileSchema,
  type OverridesFile,
  type StationsFile,
} from "../shared/registry.ts";
import { snapshotPath, type Snapshot } from "../shared/snapshot.ts";

export const formatJson = (value: unknown) => JSON.stringify(value, null, 2) + "\n";

export async function loadRegistry(
  dir = "registry",
): Promise<{ registry: StationsFile; overrides: OverridesFile }> {
  const read = async (file: string) => JSON.parse(await readFile(join(dir, file), "utf8"));
  return {
    registry: StationsFileSchema.parse(await read("stations.json")),
    overrides: OverridesFileSchema.parse(await read("overrides.json")),
  };
}

export async function writeSnapshot(dataDir: string, snapshot: Snapshot): Promise<string> {
  const path = join(dataDir, snapshotPath(snapshot.date));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, formatJson(snapshot));
  return path;
}

/** status/last-run.json: the outcome of the latest run, stored or not. */
export function lastRun(result: CollectResult, now: Date) {
  const sources = result.ok ? result.snapshot.sources : result.sources;
  const sourceReasons = result.ok ? result.snapshot.sourceReasons : result.sourceReasons;
  return {
    at: now.toISOString(),
    outcome: result.ok ? "stored" : "failed",
    reason: result.ok ? null : result.reason,
    date: result.ok ? result.snapshot.date : null,
    sources,
    sourceReasons,
    stations: result.ok ? Object.keys(result.snapshot.stations).length : 0,
    unmatched: result.ok ? result.snapshot.unmatched : [],
    warnings: result.ok ? result.snapshot.warnings : [],
  };
}

export async function writeLastRun(dataDir: string, status: ReturnType<typeof lastRun>) {
  const path = join(dataDir, "status/last-run.json");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, formatJson(status));
}

/** "data: snapshot 2026-11-22 (pmo ok, pod ok, poh paused, pvl ok, pla failed)" */
export function commitMessage(status: ReturnType<typeof lastRun>): string {
  const list = Object.entries(status.sources)
    .map(([code, s]) => `${code} ${s}`)
    .join(", ");
  return status.outcome === "stored"
    ? `data: snapshot ${status.date} (${list})`
    : `data: failed run ${status.at.slice(0, 10)} (${list})`;
}
