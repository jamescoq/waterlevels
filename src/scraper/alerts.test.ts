import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { findAlerts, readRecentSnapshots } from "./alerts.ts";
import { formatJson } from "./output.ts";
import { snapshotPath, type Snapshot, type SourceStatus } from "../shared/snapshot.ts";

type Statuses = Partial<Snapshot["sources"]>;

const day = (
  date: string,
  statuses: Statuses = {},
  unmatched: Snapshot["unmatched"] = [],
): Snapshot => {
  const sources: Snapshot["sources"] = {
    pmo: "ok",
    pod: "ok",
    poh: "paused",
    pvl: "ok",
    pla: "ok",
    ...statuses,
  };
  return {
    schemaVersion: 1,
    date,
    fetchedAt: `${date}T07:17:00.000Z`,
    sources,
    sourceReasons: Object.fromEntries(
      Object.entries(sources).map(([k, v]) => [k, v === "ok" ? null : `reason for ${v}`]),
    ) as Snapshot["sourceReasons"],
    stations: {},
    unmatched,
    warnings: [],
  };
};

const newDam = { source: "pla" as const, portalId: { id: "999", oid: "1" }, name: "Nová nádrž" };

describe("findAlerts", () => {
  it("is quiet on a normal day", () => {
    expect(findAlerts([day("2026-11-20"), day("2026-11-21"), day("2026-11-22")])).toEqual([]);
  });

  it("alerts the same day a source is partial (spec: Layout change)", () => {
    const alerts = findAlerts([day("2026-11-21"), day("2026-11-22", { pmo: "partial" })]);
    expect(alerts).toEqual([
      expect.stringMatching(/^pmo is partial on 2026-11-22: reason for partial/),
    ]);
  });

  it("alerts after three runs without data (spec: Portal down for three days)", () => {
    const failed = (d: string, s: SourceStatus) => day(d, { pla: s });
    const alerts = findAlerts([
      failed("2026-11-20", "failed"),
      failed("2026-11-21", "blocked"),
      failed("2026-11-22", "failed"),
    ]);
    expect(alerts).toEqual([expect.stringMatching(/^pla has delivered no usable data for 3 runs/)]);
  });

  it("does not alert after two days, or after a one-day outage (spec: One-day outage)", () => {
    expect(
      findAlerts([day("2026-11-21", { pla: "failed" }), day("2026-11-22", { pla: "failed" })]),
    ).toEqual([]);
    expect(
      findAlerts([
        day("2026-11-20", { pla: "failed" }),
        day("2026-11-21", { pla: "ok" }),
        day("2026-11-22", { pla: "failed" }),
      ]),
    ).toEqual([]);
  });

  it("never alerts about a paused source (spec: Paused source)", () => {
    expect(findAlerts([day("2026-11-20"), day("2026-11-21"), day("2026-11-22")])).toEqual([]);
  });

  it("alerts once about a new unregistered station (spec: New reservoir on a portal)", () => {
    expect(findAlerts([day("2026-11-21"), day("2026-11-22", {}, [newDam])])).toEqual([
      expect.stringMatching(/new unregistered station on pla: "Nová nádrž" \(id=999, oid=1\)/),
    ]);
    expect(findAlerts([day("2026-11-21", {}, [newDam]), day("2026-11-22", {}, [newDam])])).toEqual(
      [],
    );
  });
});

describe("readRecentSnapshots", () => {
  it("reads the newest snapshots across years, oldest first", async () => {
    const dir = await mkdtemp(join(tmpdir(), "stavvody-data-"));
    for (const date of ["2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02"]) {
      const path = join(dir, snapshotPath(date));
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, formatJson(day(date)));
    }
    const snapshots = await readRecentSnapshots(dir, 3);
    expect(snapshots.map((s) => s.date)).toEqual(["2025-12-31", "2026-01-01", "2026-01-02"]);
  });

  it("returns nothing for an empty data branch", async () => {
    expect(await readRecentSnapshots(await mkdtemp(join(tmpdir(), "stavvody-empty-")), 3)).toEqual(
      [],
    );
  });
});
