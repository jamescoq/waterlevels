/**
 * Daily snapshot on the data branch: snapshots/YYYY/YYYY-MM-DD.json (design.md Decision 6).
 * Every value read from the two daily pages, nothing derived.
 */
import { z } from "zod";
import { SOURCE_CODES } from "./registry.ts";

export const SOURCE_STATUSES = ["ok", "failed", "blocked", "partial", "paused"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

const isoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
const value = z.number().nullable();

const ZoneSchema = z.union([
  z.literal("undefined-zone"),
  z.object({ filled: value, filledPct: value, free: value, freePct: value }).strict(),
]);

export const SnapshotStationSchema = z
  .object({
    /** From the overview page; Prague time with offset. */
    measuredAt: isoDateTime.nullable(),
    /** From the volumes page, which can lag the overview. */
    volumesMeasuredAt: isoDateTime.nullable(),
    level: value,
    volume: value,
    inflow: value,
    outflow: value,
    precipitation1h: value,
    precipitation24h: value,
    airTemperature: value,
    floodThresholds: z
      .partialRecord(z.enum(["Qa", "Q1", "Q5", "Q20", "Q100"]), z.number())
      .nullable(),
    purpose: z.string().nullable(),
    storage: ZoneSchema,
    retentionControllable: ZoneSchema,
    retentionUncontrollable: ZoneSchema,
    note: z.string(),
  })
  .strict();

const perSource = <T extends z.ZodType>(schema: T) =>
  z
    .object(
      Object.fromEntries(SOURCE_CODES.map((code) => [code, schema])) as Record<
        (typeof SOURCE_CODES)[number],
        T
      >,
    )
    .strict();

export const SnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    /** Prague calendar date the snapshot belongs to. */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fetchedAt: isoDateTime,
    sources: perSource(z.enum(SOURCE_STATUSES)),
    /** Why a source is not "ok"; null when it is. */
    sourceReasons: perSource(z.string().nullable()),
    stations: z.record(z.string(), SnapshotStationSchema),
    unmatched: z.array(
      z
        .object({
          source: z.enum(SOURCE_CODES),
          portalId: z.object({ id: z.string(), oid: z.string() }).strict(),
          name: z.string(),
        })
        .strict(),
    ),
    warnings: z.array(z.string()),
  })
  .strict();

export type SnapshotStation = z.infer<typeof SnapshotStationSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;

/** Prague calendar date (YYYY-MM-DD) of an instant. */
export function pragueDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** snapshots/2026/2026-11-22.json */
export const snapshotPath = (date: string) => `snapshots/${date.slice(0, 4)}/${date}.json`;
