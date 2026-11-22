/**
 * Schemas of the hand-kept registry files: registry/stations.json and registry/overrides.json
 * (design.md Decision 6). Both are validated in CI.
 */
import { z } from "zod";

export const SOURCE_CODES = ["pmo", "pod", "poh", "pvl", "pla"] as const;
export const BASINS = ["moravy", "odry", "ohre", "vltavy", "labe"] as const;

const sourceCode = z.enum(SOURCE_CODES);
const level = z.number().min(100).max(1700).nullable();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const PortalIdSchema = z.object({ id: z.string().min(1), oid: z.string().regex(/^\d+$/) });

export const StationSchema = z
  .object({
    /** Source code + slug of the name; never changes once published (share links use it). */
    id: z.string().regex(/^(pmo|pod|poh|pvl|pla)-[a-z0-9]+(?:-[a-z0-9]+)*$/),
    kind: z.literal("reservoir"),
    name: z.string().min(1),
    source: sourceCode,
    basin: z.enum(BASINS),
    river: z.string(),
    portalId: PortalIdSchema,
    sourceUrl: z.url(),
    /** WGS84; null until coordinates are filled in. */
    lat: z.number().min(48.5).max(51.1).nullable(),
    lon: z.number().min(12).max(19).nullable(),
    /** Where the coordinates came from, e.g. "wikidata:Q1234", "osm:way/123", "manual". */
    coordinateSource: z.string().nullable(),
    /** m a.s.l., from the detail page; null where the portal gives none. */
    levels: z.object({
      crest: level,
      spillway: level,
      maxRetention: level,
      storage: level,
      permanent: level,
    }),
    heightDatum: z.string().nullable(),
    /** Storage zone capacity in mil. m³ when the registry was built (filled + free). */
    storageVolume: z.number().positive().nullable(),
    /** "Účel" as the portal publishes it; null where it gives none. */
    portalPurpose: z.string().nullable(),
    /** Collected for later versions; not shown in v1. */
    purposes: z.array(z.enum(["drinking", "recreation", "hydropower", "flood"])),
    /** Kept in the registry but not shown on the site. */
    hidden: z.boolean(),
  })
  .strict();

export const IgnoredRowSchema = z
  .object({
    source: sourceCode,
    portalId: PortalIdSchema,
    name: z.string(),
    reason: z.string().min(1),
  })
  .strict();

export const StationsFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    stations: z.array(StationSchema),
    /** Portal rows that are deliberately not stations, so they never count as unmatched. */
    ignoredRows: z.array(IgnoredRowSchema),
  })
  .strict()
  .superRefine((file, ctx) => {
    const seen = new Map<string, string>();
    const check = (key: string, what: string, path: (string | number)[]) => {
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", message: `${what} also used by ${seen.get(key)}`, path });
      } else seen.set(key, what);
    };
    file.stations.forEach((s, i) => {
      check(`id:${s.id}`, `id ${s.id}`, ["stations", i, "id"]);
      check(`portal:${s.source}/${s.portalId.id}/${s.portalId.oid}`, s.id, [
        "stations",
        i,
        "portalId",
      ]);
      if (!s.id.startsWith(`${s.source}-`)) {
        ctx.addIssue({
          code: "custom",
          message: "id must start with the source code",
          path: ["stations", i, "id"],
        });
      }
      if ((s.lat === null) !== (s.lon === null)) {
        ctx.addIssue({
          code: "custom",
          message: "lat and lon must both be set or both be null",
          path: ["stations", i],
        });
      }
    });
    file.ignoredRows.forEach((r, i) =>
      check(`portal:${r.source}/${r.portalId.id}/${r.portalId.oid}`, `ignored row ${r.name}`, [
        "ignoredRows",
        i,
      ]),
    );
  });

export const OverrideSchema = z
  .object({
    status: z.literal("planned"),
    /** Czech text for the card's note box. */
    reason: z.string().min(1),
    from: isoDate.optional(),
    until: isoDate.optional(),
  })
  .strict()
  .refine((o) => !o.from || !o.until || o.from <= o.until, "from must not be after until");

export const OverridesFileSchema = z.record(z.string(), OverrideSchema);

export type Station = z.infer<typeof StationSchema>;
export type StationsFile = z.infer<typeof StationsFileSchema>;
export type Override = z.infer<typeof OverrideSchema>;
export type OverridesFile = z.infer<typeof OverridesFileSchema>;

/** Whether an override applies on a given Prague calendar date (YYYY-MM-DD). */
export function isOverrideActive(override: Override, today: string): boolean {
  return (!override.from || override.from <= today) && (!override.until || today <= override.until);
}

/** "VD Plzeň-Štruncovy sady" → "plzen-struncovy-sady". */
export function slugOf(name: string): string {
  return name
    .replace(/^VD\s+/i, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
