/**
 * Regenerates snapshots from raw-page archives after a parser fix (tasks 5.4).
 *
 *   pnpm reparse <archive-dir>... [--data-dir data]
 *
 * Each archive is a downloaded "raw-pages-…" artifact of a scrape run (kept 90 days):
 *
 *   gh run list -R jamescoq/waterlevels -w scrape.yml --created ">=2026-11-01" --json databaseId
 *   gh run download <run-id> -R jamescoq/waterlevels -D archives/<run-id>
 *
 * The run is replayed with the current parser and registry, and that day's snapshot rewritten.
 */
import { readArchive } from "./archive.ts";
import { collect } from "./collect.ts";
import { loadRegistry, writeSnapshot } from "./output.ts";

const args = process.argv.slice(2);
const dataFlag = args.indexOf("--data-dir");
const dataDir = dataFlag >= 0 ? (args[dataFlag + 1] ?? "data") : "data";
const archives = args.filter((a, i) => !a.startsWith("--") && i !== dataFlag + 1);
if (archives.length === 0) {
  console.error("usage: pnpm reparse <archive-dir>... [--data-dir data]");
  process.exit(2);
}

const { registry, overrides } = await loadRegistry();
for (const dir of archives) {
  const { fetchedAt, fetcher } = await readArchive(dir);
  const result = await collect({
    fetcher,
    registry,
    overrides,
    now: fetchedAt,
    sleep: async () => {},
  });
  if (!result.ok) {
    console.error(`${dir}: no snapshot (${result.reason})`);
    process.exitCode = 1;
    continue;
  }
  console.log(`${dir} → ${await writeSnapshot(dataDir, result.snapshot)}`);
}
