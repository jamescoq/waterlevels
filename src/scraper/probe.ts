/**
 * Portal probe (tasks 2.1): fetches robots.txt, the overview page and the volumes page of every
 * Povodí source, saves them, and reports status codes, station counts, column headings and how
 * fresh the newest measurement is. Writes nothing to the repository.
 *
 *   pnpm probe [outDir]        default outDir: probe-out
 *
 * In GitHub Actions the report is also appended to the job summary.
 */
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BOT_TOKEN } from "./config.ts";
import { PoliteClient, type FetchResult } from "./http.ts";
import { analyzePage, type PageAnalysis } from "./probe-analyze.ts";
import { policyFromResponse } from "./robots.ts";
import { DAILY_PAGES, SOURCES, type DailyPage, type SourceCode } from "./sources.ts";

interface PageReport {
  url: string;
  status: number | null;
  error: string | null;
  bytes: number;
  attempts: number;
  durationMs: number;
  skipped: string | null;
  analysis: PageAnalysis | null;
}

interface SourceReport {
  code: SourceCode;
  name: string;
  robots: { status: number | null; summary: string };
  pages: Record<DailyPage, PageReport>;
}

const outDir = process.argv[2] ?? "probe-out";
const client = new PoliteClient();
const startedAt = new Date();

const reports: SourceReport[] = [];
for (const source of SOURCES) {
  const dir = join(outDir, source.code);
  await mkdir(dir, { recursive: true });

  const robotsUrl = new URL("/robots.txt", source.baseUrl).href;
  const robots = await client.get(robotsUrl);
  await writeFile(join(dir, "robots.txt"), robots.body);
  const policy = policyFromResponse(robots.status, robots.body, BOT_TOKEN);

  const pages = {} as Record<DailyPage, PageReport>;
  for (const [page, file] of Object.entries(DAILY_PAGES) as [DailyPage, string][]) {
    const url = new URL(file, source.baseUrl);
    if (!policy.isAllowed(url.pathname + url.search)) {
      pages[page] = skippedPage(url.href, `disallowed by robots.txt (${policy.summary})`);
      continue;
    }
    const result = await client.get(url.href);
    await writeFile(join(dir, `${page}.html`), result.body);
    pages[page] = pageReport(result);
  }

  reports.push({
    code: source.code,
    name: source.name,
    robots: { status: robots.status, summary: policy.summary },
    pages,
  });
  console.error(`probed ${source.code}`);
}

const summary = {
  startedAt: startedAt.toISOString(),
  runner: process.env.GITHUB_ACTIONS ? `GitHub Actions (${process.env.RUNNER_OS ?? "?"})` : "local",
  sources: reports,
};
const markdown = renderMarkdown(summary.runner, startedAt, reports);

await writeFile(join(outDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
await writeFile(join(outDir, "summary.md"), markdown);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
console.log(markdown);

function pageReport(result: FetchResult): PageReport {
  const ok = result.status !== null && result.status < 400;
  return {
    url: result.finalUrl,
    status: result.status,
    error: result.error,
    bytes: Buffer.byteLength(result.body),
    attempts: result.attempts,
    durationMs: result.durationMs,
    skipped: null,
    analysis: ok ? analyzePage(result.body) : null,
  };
}

function skippedPage(url: string, reason: string): PageReport {
  return {
    url,
    status: null,
    error: null,
    bytes: 0,
    attempts: 0,
    durationMs: 0,
    skipped: reason,
    analysis: null,
  };
}

function renderMarkdown(runner: string, at: Date, sources: SourceReport[]): string {
  const lines = [
    `## Portal probe, ${at.toISOString()} (${runner})`,
    "",
    "| Source | robots.txt | Overview | Volumes | Stations (rows) | Newest measurement | Age |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const s of sources) {
    const o = s.pages.overview;
    const v = s.pages.volumes;
    const a = o.analysis;
    lines.push(
      `| ${s.code} (${s.name}) | ${s.robots.status ?? "no response"}: ${s.robots.summary} | ${pageCell(o)} | ${pageCell(v)} | ${
        a ? `${a.stations} (${a.rows})` : "–"
      } | ${a?.newestMeasurement ?? "–"} | ${age(a?.newestMeasurementIso ?? null, at)} |`,
    );
  }
  lines.push("", "### Columns", "");
  for (const s of sources) {
    for (const page of Object.keys(DAILY_PAGES) as DailyPage[]) {
      const cols = s.pages[page].analysis?.columns;
      lines.push(`- **${s.code} ${page}:** ${cols?.length ? cols.join(" · ") : "–"}`);
    }
  }
  return lines.join("\n") + "\n";
}

function pageCell(p: PageReport): string {
  if (p.skipped) return `skipped: ${p.skipped}`;
  if (p.status === null) return `failed: ${p.error ?? "no response"} (${p.attempts} attempts)`;
  return `${p.status}, ${Math.round(p.bytes / 1024)} KB, ${p.durationMs} ms`;
}

function age(iso: string | null, now: Date): string {
  if (!iso) return "–";
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  return minutes < 120 ? `${minutes} min` : `${(minutes / 60).toFixed(1)} h`;
}
