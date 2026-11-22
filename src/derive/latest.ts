/**
 * Builds latest.json (tasks 6.4) from the registry, the overrides and the recent snapshots.
 */
import { changeSinceYesterday, type Measurement } from "./change.ts";
import {
  MIN_DIAMETER_DESKTOP,
  MIN_DIAMETER_PHONE,
  layoutCircles,
  type CircleInput,
} from "./circles.ts";
import { SOURCES } from "../scraper/sources.ts";
import { LatestSchema, type Latest, type LatestStation } from "../shared/latest.ts";
import { DESKTOP_MAP_WIDTH, PHONE_MAP_WIDTH, mapFrame } from "../shared/projection.ts";
import {
  isOverrideActive,
  type OverridesFile,
  type Station,
  type StationsFile,
} from "../shared/registry.ts";
import { pragueDate, type Snapshot, type SnapshotStation } from "../shared/snapshot.ts";
import { deriveStatus } from "../shared/status.ts";

export interface BuildLatestOptions {
  registry: StationsFile;
  overrides: OverridesFile;
  /** Recent snapshots, oldest first; may be empty before the first collection. */
  snapshots: Snapshot[];
  now: Date;
}

export function buildLatest({ registry, overrides, snapshots, now }: BuildLatestOptions): Latest {
  const latest = snapshots.at(-1);
  const previous = snapshots.at(-2);
  const earlier = snapshots.slice(0, -1);
  const today = pragueDate(now);
  const shown = registry.stations.filter((s) => !s.hidden);

  const desktopFrame = mapFrame(DESKTOP_MAP_WIDTH);
  const phoneFrame = mapFrame(PHONE_MAP_WIDTH);
  const placed: CircleInput[] = shown
    .filter((s) => s.lat !== null && s.lon !== null)
    .map((s) => ({ id: s.id, lon: s.lon!, lat: s.lat!, capacity: s.storageVolume }));
  const desktop = layoutCircles(placed, desktopFrame, MIN_DIAMETER_DESKTOP);
  const phone = layoutCircles(placed, phoneFrame, MIN_DIAMETER_PHONE);

  const stations = shown.map((station): LatestStation => {
    const sourceStatus = latest?.sources[station.source] ?? "failed";
    const current = latest?.stations[station.id];
    const lastKnown = current ? undefined : findLastKnown(station.id, earlier);
    const values = current ?? lastKnown;
    const override = overrides[station.id];
    const overrideActive = override ? isOverrideActive(override, today) : false;

    const storage = values?.storage ?? { filled: null, filledPct: null, free: null, freePct: null };
    const { status, levelOnlyReason } = deriveStatus(
      {
        sourceStatus,
        // Only today's measurement can make a station current.
        measuredAt: current?.measuredAt ?? null,
        level: current?.level ?? null,
        storageLevel: station.levels.storage,
        storage: storage === "undefined-zone" ? storage : { filledPct: storage.filledPct },
        retentionFilled: values ? retentionFilled(values) : null,
        plannedDrawdownActive: overrideActive,
      },
      now,
    );
    const zone = storage === "undefined-zone" ? null : storage;

    return {
      id: station.id,
      name: station.name,
      river: station.river,
      basin: station.basin,
      source: station.source,
      sourceName: SOURCES.find((s) => s.code === station.source)!.name,
      sourceStatus,
      sourceUrl: station.sourceUrl,
      desktop: desktop.get(station.id) ?? null,
      phone: phone.get(station.id) ?? null,
      buildStatus: status,
      levelOnlyReason,
      fillPct: zone?.filledPct == null ? null : Math.min(100, zone.filledPct),
      fillPctRaw: zone?.filledPct ?? null,
      storageFilled: zone?.filled ?? null,
      storageCapacity:
        zone?.filled != null && zone.free != null ? round(zone.filled + zone.free, 3) : null,
      level: values?.level ?? null,
      volume: values?.volume ?? null,
      inflow: values?.inflow ?? null,
      outflow: values?.outflow ?? null,
      levels: station.levels,
      changeCm: current
        ? changeSinceYesterday(
            measurement(current),
            previous?.stations[station.id] && measurement(previous.stations[station.id]!),
            earlier.flatMap((s) =>
              s.stations[station.id] ? [measurement(s.stations[station.id]!)] : [],
            ),
          )
        : null,
      measuredAt: values?.measuredAt ?? null,
      isLastKnown: !current && lastKnown !== undefined,
      overrideReason: overrideActive ? override!.reason : null,
      portalNote: values?.note ?? "",
    };
  });

  return LatestSchema.parse({
    schemaVersion: 1,
    builtAt: now.toISOString(),
    lastSuccessfulFetch: latest?.fetchedAt ?? null,
    sources: latest?.sources ?? Object.fromEntries(SOURCES.map((s) => [s.code, "failed"])),
    sourceReasons:
      latest?.sourceReasons ??
      Object.fromEntries(SOURCES.map((s) => [s.code, "no data collected yet"])),
    map: {
      desktop: { width: desktopFrame.width, height: desktopFrame.height },
      phone: { width: phoneFrame.width, height: phoneFrame.height },
    },
    // Larger circles first, so smaller ones are drawn on top where they still overlap.
    stations: stations.sort(
      (a, b) => (b.desktop?.r ?? 0) - (a.desktop?.r ?? 0) || a.id.localeCompare(b.id),
    ),
  });
}

function findLastKnown(id: Station["id"], earlier: Snapshot[]): SnapshotStation | undefined {
  for (let i = earlier.length - 1; i >= 0; i--) {
    const station = earlier[i]!.stations[id];
    if (station) return station;
  }
  return undefined;
}

function retentionFilled(station: SnapshotStation): number | null {
  const parts = [station.retentionControllable, station.retentionUncontrollable]
    .map((zone) => (zone === "undefined-zone" ? null : zone.filled))
    .filter((v): v is number => v !== null);
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

const measurement = (s: SnapshotStation): Measurement => ({
  measuredAt: s.measuredAt,
  level: s.level,
});

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;
