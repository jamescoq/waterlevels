/**
 * One daily collection run (water-data-collection spec): fetch each source's overview and
 * volumes page, match rows to the registry, check plausibility, and assemble the snapshot.
 *
 * Network access goes through a PageFetcher, so the same code runs live (PoliteClient), against
 * recorded pages (re-parsing, tasks 5.4) and against fixtures in tests.
 */
import { BOT_TOKEN } from "./config.ts";
import type { FetchResult } from "./http.ts";
import { checkPlausibility } from "./plausibility.ts";
import {
  LayoutError,
  isLoadingPage,
  parseOverview,
  parseVolumes,
  type VolumesRow,
  type Zone,
} from "./portals/mge.ts";
import { policyFromResponse } from "./robots.ts";
import { DAILY_PAGES, SOURCES, type Source, type SourceCode } from "./sources.ts";
import {
  isOverrideActive,
  type OverridesFile,
  type Station,
  type StationsFile,
} from "../shared/registry.ts";
import {
  SnapshotSchema,
  pragueDate,
  type Snapshot,
  type SnapshotStation,
  type SourceStatus,
} from "../shared/snapshot.ts";

export interface PageFetcher {
  get(url: string): Promise<FetchResult>;
}

/** Every response the run received, in order, for the raw-page archive. */
export interface RecordedResponse {
  source: SourceCode;
  url: string;
  status: number | null;
  error: string | null;
  body: string;
}

export interface CollectOptions {
  fetcher: PageFetcher;
  registry: StationsFile;
  overrides: OverridesFile;
  /** Start of the run; becomes fetchedAt and decides the snapshot date. */
  now: Date;
  sources?: readonly Source[];
  /** Wait before fetching a page again after a "načítám data" placeholder. */
  loadingRetryDelayMs?: number;
  loadingRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

export type CollectResult =
  | { ok: true; snapshot: Snapshot; recorded: RecordedResponse[] }
  | {
      ok: false;
      reason: string;
      sources: Snapshot["sources"];
      sourceReasons: Snapshot["sourceReasons"];
      recorded: RecordedResponse[];
    };

/** A source returning fewer of its registered stations than this is "partial". */
export const MIN_SHARE_OF_STATIONS = 0.7;

interface SourceOutcome {
  status: SourceStatus;
  reason: string | null;
  stations: Record<string, SnapshotStation>;
  unmatched: Snapshot["unmatched"];
  warnings: string[];
}

const portalKey = (id: string, oid: string) => `${id}/${oid}`;

export async function collect(options: CollectOptions): Promise<CollectResult> {
  const sources = options.sources ?? SOURCES;
  const recorded: RecordedResponse[] = [];
  const today = pragueDate(options.now);

  const outcomes = await Promise.all(
    sources.map((source) => collectSource(source, options, today, recorded)),
  );
  const byCode = new Map(sources.map((s, i) => [s.code, outcomes[i]!]));

  const sourceStatus = {} as Snapshot["sources"];
  const sourceReasons = {} as Snapshot["sourceReasons"];
  for (const source of SOURCES) {
    const outcome = byCode.get(source.code);
    sourceStatus[source.code] = outcome?.status ?? "paused";
    sourceReasons[source.code] = outcome ? outcome.reason : "not part of this run";
  }

  if (!outcomes.some((o) => o.status === "ok")) {
    return {
      ok: false,
      reason: "no source delivered usable data",
      sources: sourceStatus,
      sourceReasons,
      recorded,
    };
  }

  const candidate = {
    schemaVersion: 1,
    date: today,
    fetchedAt: options.now.toISOString(),
    sources: sourceStatus,
    sourceReasons,
    stations: Object.fromEntries(outcomes.flatMap((o) => Object.entries(o.stations))),
    unmatched: outcomes.flatMap((o) => o.unmatched),
    warnings: outcomes.flatMap((o) => o.warnings),
  };
  const parsed = SnapshotSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      reason: `snapshot does not match its schema: ${parsed.error.message}`,
      sources: sourceStatus,
      sourceReasons,
      recorded,
    };
  }
  return { ok: true, snapshot: parsed.data, recorded };
}

async function collectSource(
  source: Source,
  options: CollectOptions,
  today: string,
  recorded: RecordedResponse[],
): Promise<SourceOutcome> {
  const empty = (status: SourceStatus, reason: string): SourceOutcome => ({
    status,
    reason,
    stations: {},
    unmatched: [],
    warnings: [],
  });

  if (source.paused) return empty("paused", source.paused);

  const fetch = async (url: string) => {
    const result = await options.fetcher.get(url);
    recorded.push({
      source: source.code,
      url,
      status: result.status,
      error: result.error,
      body: result.body,
    });
    return result;
  };

  const robots = await fetch(new URL("/robots.txt", source.baseUrl).href);
  if (robots.status === null || robots.status >= 500) {
    return empty("failed", `robots.txt unreachable (${robots.status ?? robots.error})`);
  }
  const policy = policyFromResponse(robots.status, robots.body, BOT_TOKEN);

  const pages: Partial<Record<keyof typeof DAILY_PAGES, string>> = {};
  for (const [page, file] of Object.entries(DAILY_PAGES) as [keyof typeof DAILY_PAGES, string][]) {
    const url = new URL(file, source.baseUrl);
    if (!policy.isAllowed(url.pathname + url.search)) {
      return empty("blocked", `${file} disallowed by robots.txt`);
    }
    const body = await fetchPage(url.href, fetch, options);
    if (typeof body !== "string") return empty("failed", `${file}: ${body.reason}`);
    pages[page] = body;
  }

  let overview, volumes;
  try {
    overview = parseOverview(pages.overview!);
    volumes = parseVolumes(pages.volumes!);
  } catch (err) {
    if (err instanceof LayoutError) return empty("partial", `layout changed: ${err.message}`);
    throw err;
  }

  const registered = options.registry.stations.filter((s) => s.source === source.code);
  const byPortal = new Map(registered.map((s) => [portalKey(s.portalId.id, s.portalId.oid), s]));
  const ignored = new Set(
    options.registry.ignoredRows
      .filter((r) => r.source === source.code)
      .map((r) => portalKey(r.portalId.id, r.portalId.oid)),
  );
  const volumesOf = new Map(volumes.map((v) => [portalKey(v.portalId.id, v.portalId.oid), v]));

  const outcome: SourceOutcome = {
    status: "ok",
    reason: null,
    stations: {},
    unmatched: [],
    warnings: [],
  };
  for (const row of overview) {
    const key = portalKey(row.portalId.id, row.portalId.oid);
    if (ignored.has(key)) continue;
    const station = byPortal.get(key);
    if (!station) {
      outcome.unmatched.push({ source: source.code, portalId: row.portalId, name: row.name });
      outcome.warnings.push(`${source.code}: unregistered station "${row.name}" (${key})`);
      continue;
    }
    const vol = volumesOf.get(key);
    if (!vol) outcome.warnings.push(`${station.id}: not on the volumes page`);
    outcome.stations[station.id] = toSnapshotStation(
      row,
      vol,
      station,
      options.overrides,
      today,
      outcome.warnings,
    );
  }

  const matched = Object.keys(outcome.stations).length;
  if (registered.length > 0 && matched < MIN_SHARE_OF_STATIONS * registered.length) {
    return empty("partial", `only ${matched} of ${registered.length} registered stations found`);
  }
  return outcome;
}

/** Fetches a page, retrying while the portal shows its "načítám data" placeholder. */
async function fetchPage(
  url: string,
  fetch: (url: string) => Promise<FetchResult>,
  options: CollectOptions,
): Promise<string | { reason: string }> {
  const retries = options.loadingRetries ?? 2;
  const delay = options.loadingRetryDelayMs ?? 30_000;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; ; attempt++) {
    const result = await fetch(url);
    if (result.status !== 200) return { reason: `HTTP ${result.status ?? result.error}` };
    if (!isLoadingPage(result.body)) return result.body;
    if (attempt === retries) return { reason: `still "načítám data" after ${retries} retries` };
    await sleep(delay);
  }
}

const emptyZone: Zone = { filled: null, filledPct: null, free: null, freePct: null };

function toSnapshotStation(
  row: ReturnType<typeof parseOverview>[number],
  vol: VolumesRow | undefined,
  station: Station,
  overrides: OverridesFile,
  today: string,
  warnings: string[],
): SnapshotStation {
  const override = overrides[station.id];
  const checked = checkPlausibility(
    {
      level: row.level,
      zones: {
        storage: vol?.storage ?? emptyZone,
        retentionControllable: vol?.retentionControllable ?? emptyZone,
        retentionUncontrollable: vol?.retentionUncontrollable ?? emptyZone,
      },
    },
    {
      name: station.id,
      levels: { crest: station.levels.crest, permanent: station.levels.permanent },
      plannedDrawdownActive: override ? isOverrideActive(override, today) : false,
    },
  );
  warnings.push(...checked.warnings);
  return {
    measuredAt: row.measuredAt,
    volumesMeasuredAt: vol?.measuredAt ?? null,
    level: checked.level,
    volume: row.volume,
    inflow: row.inflow,
    outflow: row.outflow,
    precipitation1h: row.precipitation1h,
    precipitation24h: row.precipitation24h,
    airTemperature: row.airTemperature,
    floodThresholds: row.floodThresholds,
    purpose: row.purpose,
    storage: checked.zones.storage,
    retentionControllable: checked.zones.retentionControllable,
    retentionUncontrollable: checked.zones.retentionUncontrollable,
    note: row.note,
  };
}
