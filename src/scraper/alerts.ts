/**
 * Owner notification (water-data-collection spec, "Owner notification"; tasks 5.6).
 *
 *   pnpm alerts [--data-dir data]
 *
 * Runs as the last job of the scrape workflow, after the snapshot is committed and the site
 * deployed. Exits with 1, which fails the job and makes GitHub email the owner, when:
 *   - a source is "partial" in the latest snapshot (layout change or too few rows),
 *   - a source that is not paused delivered no usable data in the last three snapshots,
 *   - the latest snapshot lists an unregistered station the previous one did not.
 */
import { appendFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { SnapshotSchema, type Snapshot, type SourceStatus } from "../shared/snapshot.ts";

const NO_DATA: SourceStatus[] = ["failed", "blocked", "partial"];
export const DAYS_WITHOUT_DATA = 3;

/** Alerts for the latest snapshot; `snapshots` are in date order, oldest first. */
export function findAlerts(snapshots: Snapshot[]): string[] {
  const latest = snapshots.at(-1);
  if (!latest) return [];
  const previous = snapshots.at(-2);
  const alerts: string[] = [];

  for (const [code, status] of Object.entries(latest.sources)) {
    if (status === "partial") {
      alerts.push(
        `${code} is partial on ${latest.date}: ${latest.sourceReasons[code as keyof Snapshot["sources"]]}`,
      );
    }
  }

  const recent = snapshots.slice(-DAYS_WITHOUT_DATA);
  if (recent.length === DAYS_WITHOUT_DATA) {
    for (const code of Object.keys(latest.sources) as (keyof Snapshot["sources"])[]) {
      if (recent.every((s) => NO_DATA.includes(s.sources[code]))) {
        alerts.push(
          `${code} has delivered no usable data for ${DAYS_WITHOUT_DATA} runs (${recent.map((s) => `${s.date}: ${s.sources[code]}`).join(", ")}); latest reason: ${latest.sourceReasons[code]}`,
        );
      }
    }
  }

  const known = new Set(
    (previous?.unmatched ?? []).map((u) => `${u.source}/${u.portalId.id}/${u.portalId.oid}`),
  );
  for (const u of latest.unmatched) {
    if (!known.has(`${u.source}/${u.portalId.id}/${u.portalId.oid}`)) {
      alerts.push(
        `new unregistered station on ${u.source}: "${u.name}" (id=${u.portalId.id}, oid=${u.portalId.oid}); run pnpm registry:build`,
      );
    }
  }
  return alerts;
}

/** The last `count` snapshots under <dataDir>/snapshots, oldest first. */
export async function readRecentSnapshots(dataDir: string, count: number): Promise<Snapshot[]> {
  const root = join(dataDir, "snapshots");
  const years = (await readdir(root).catch(() => [])).filter((y) => /^\d{4}$/.test(y)).sort();
  const files: string[] = [];
  for (const year of years) {
    for (const file of (await readdir(join(root, year))).filter((f) =>
      /^\d{4}-\d{2}-\d{2}\.json$/.test(f),
    )) {
      files.push(join(root, year, file));
    }
  }
  files.sort();
  return Promise.all(
    files
      .slice(-count)
      .map(async (f) => SnapshotSchema.parse(JSON.parse(await readFile(f, "utf8")))),
  );
}

async function main() {
  const i = process.argv.indexOf("--data-dir");
  const dataDir = i >= 0 ? (process.argv[i + 1] ?? "data") : "data";
  const alerts = findAlerts(await readRecentSnapshots(dataDir, DAYS_WITHOUT_DATA));
  if (alerts.length === 0) {
    console.log("No alerts.");
    return;
  }
  const text = alerts.map((a) => `- ${a}`).join("\n");
  console.error(`Alerts:\n${text}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Data alerts\n\n${text}\n`);
  }
  process.exitCode = 1;
}

if (process.argv[1]?.endsWith("alerts.ts")) await main();
