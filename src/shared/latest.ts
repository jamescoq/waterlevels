/**
 * /data/latest.json: everything the front end needs, built from the registry, the overrides and
 * the recent snapshots (design.md Decision 6). Statuses are as of the build; the browser
 * re-applies the 36-hour rule and computes the headline itself.
 */
import { z } from "zod";
import { BASINS, SOURCE_CODES } from "./registry.ts";
import { SOURCE_STATUSES } from "./snapshot.ts";
import { STATUSES } from "./status.ts";

const value = z.number().nullable();
const circle = z.object({ x: z.number(), y: z.number(), r: z.number().positive() }).strict();
const frame = z.object({ width: z.number().positive(), height: z.number().positive() }).strict();
const perSource = <T extends z.ZodType>(schema: T) =>
  z
    .object(
      Object.fromEntries(SOURCE_CODES.map((c) => [c, schema])) as Record<
        (typeof SOURCE_CODES)[number],
        T
      >,
    )
    .strict();

export const LatestStationSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    river: z.string(),
    basin: z.enum(BASINS),
    source: z.enum(SOURCE_CODES),
    /** "Povodí Odry" etc., for the card's source line. */
    sourceName: z.string(),
    /** The source's status in the latest snapshot. */
    sourceStatus: z.enum(SOURCE_STATUSES),
    /** The station's page on its Povodí portal. */
    sourceUrl: z.url(),
    /** Positions on the 880 px desktop map and the 358 px phone map; null until placed. */
    desktop: circle.nullable(),
    phone: circle.nullable(),
    buildStatus: z.enum(STATUSES),
    levelOnlyReason: z.enum(["no-zone", "fill-not-published"]).nullable(),
    /** Storage fill for drawing, at most 100. */
    fillPct: value,
    /** Storage fill as published (can exceed 100). */
    fillPctRaw: value,
    /** mil. m³, today's figures from the volumes page. */
    storageFilled: value,
    storageCapacity: value,
    level: value,
    volume: value,
    inflow: value,
    outflow: value,
    levels: z
      .object({
        crest: value,
        spillway: value,
        maxRetention: value,
        storage: value,
        permanent: value,
      })
      .strict(),
    /** Whole cm since yesterday; 0 means under 1 cm; null when unknown. */
    changeCm: z.number().int().nullable(),
    measuredAt: z.string().nullable(),
    /** Values come from an earlier snapshot because the source has no data today. */
    isLastKnown: z.boolean(),
    /** Reason of an active planned drawdown, for the card's note. */
    overrideReason: z.string().nullable(),
    /** Portal note, verbatim; empty when there is none. */
    portalNote: z.string(),
  })
  .strict();

export const LatestSchema = z
  .object({
    schemaVersion: z.literal(1),
    builtAt: z.string(),
    /** fetchedAt of the newest snapshot; null before the first collection. */
    lastSuccessfulFetch: z.string().nullable(),
    sources: perSource(z.enum(SOURCE_STATUSES)),
    sourceReasons: perSource(z.string().nullable()),
    map: z.object({ desktop: frame, phone: frame }).strict(),
    stations: z.array(LatestStationSchema),
  })
  .strict();

export type LatestStation = z.infer<typeof LatestStationSchema>;
export type Latest = z.infer<typeof LatestSchema>;
