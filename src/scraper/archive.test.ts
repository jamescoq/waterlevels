import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readArchive, writeArchive } from "./archive.ts";
import { collect, type PageFetcher } from "./collect.ts";
import type { FetchResult } from "./http.ts";
import { formatJson, loadRegistry } from "./output.ts";
import { SOURCES } from "./sources.ts";

const root = join(import.meta.dirname, "../..");

async function fixtureFetcher(): Promise<PageFetcher> {
  const loading = await readFile(join(root, "test/fixtures/pmo/overview-loading.html"), "utf8");
  let pmoOverviewCalls = 0;
  return {
    async get(url: string): Promise<FetchResult> {
      const source = SOURCES.find((s) => url.startsWith(new URL("/", s.baseUrl).href))!;
      const page = url.endsWith("Prehled.aspx")
        ? "overview"
        : url.endsWith("Objemy.aspx")
          ? "volumes"
          : null;
      let body = "";
      if (page === "overview" && source.code === "pmo" && pmoOverviewCalls++ === 0) body = loading;
      else if (page)
        body = await readFile(join(root, "test/fixtures", source.code, `${page}.html`), "utf8");
      const status = page ? 200 : 404;
      return { url, finalUrl: url, status, body, error: null, attempts: 1, durationMs: 0 };
    },
  };
}

describe("raw-page archive (tasks 5.4)", () => {
  it("replays a run into a byte-identical snapshot, including a retried page", async () => {
    const { registry, overrides } = await loadRegistry(join(root, "registry"));
    const now = new Date("2026-11-22T09:39:00Z");
    const live = await collect({
      fetcher: await fixtureFetcher(),
      registry,
      overrides,
      now,
      sleep: async () => {},
    });
    if (!live.ok) throw new Error(live.reason);

    const dir = await mkdtemp(join(tmpdir(), "stavvody-archive-"));
    await writeArchive(dir, now, live.recorded);
    // Numbers follow the overall request order, which interleaves the sources.
    const pages = (await readdir(join(dir, "pmo"))).map((f) => f.replace(/^\d{2}-/, "")).sort();
    expect(pages).toEqual(["Objemy.aspx", "Prehled.aspx", "Prehled.aspx", "robots.txt"]);

    const { fetchedAt, fetcher } = await readArchive(dir);
    expect(fetchedAt.toISOString()).toBe(now.toISOString());
    const replayed = await collect({
      fetcher,
      registry,
      overrides,
      now: fetchedAt,
      sleep: async () => {},
    });
    if (!replayed.ok) throw new Error(replayed.reason);
    expect(formatJson(replayed.snapshot)).toBe(formatJson(live.snapshot));
  });
});
