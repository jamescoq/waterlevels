/**
 * The daily scrape (tasks 5.2, 5.3).
 *
 *   pnpm scrape [--data-dir data] [--raw-dir raw-pages]
 *
 * Writes into the data-branch checkout: snapshots/YYYY/YYYY-MM-DD.json when the run succeeds,
 * and status/last-run.json always. Writes every response to the raw-page archive. Exits with 1
 * when no snapshot could be stored, so the workflow run fails and the owner is emailed.
 */
import { appendFile } from "node:fs/promises";
import { writeArchive } from "./archive.ts";
import { collect } from "./collect.ts";
import { PoliteClient } from "./http.ts";
import { commitMessage, lastRun, loadRegistry, writeLastRun, writeSnapshot } from "./output.ts";

const arg = (flag: string, fallback: string) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};
const dataDir = arg("--data-dir", "data");
const rawDir = arg("--raw-dir", "raw-pages");

const now = new Date();
const { registry, overrides } = await loadRegistry();
const result = await collect({ fetcher: new PoliteClient(), registry, overrides, now });

await writeArchive(rawDir, now, result.recorded);
const status = lastRun(result, now);
await writeLastRun(dataDir, status);
if (result.ok) console.log(`stored ${await writeSnapshot(dataDir, result.snapshot)}`);

const message = commitMessage(status);
console.log(message);
for (const [code, reason] of Object.entries(status.sourceReasons)) {
  if (reason) console.log(`  ${code}: ${reason}`);
}
for (const warning of status.warnings) console.log(`  warning: ${warning}`);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `message=${message}\n`);

if (!result.ok) {
  console.error(`No snapshot stored: ${result.reason}`);
  process.exitCode = 1;
}
