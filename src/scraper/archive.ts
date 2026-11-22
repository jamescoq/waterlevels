/**
 * Raw-page archive of one run: every response, in order, plus when the run started. Uploaded
 * as an Actions artifact (kept 90 days) and replayed by `pnpm reparse` after a parser fix.
 *
 *   <dir>/meta.json
 *   <dir>/<source>/<nn>-<page>   response bodies, numbered in request order
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PageFetcher, RecordedResponse } from "./collect.ts";
import type { FetchResult } from "./http.ts";

interface ArchiveMeta {
  schemaVersion: 1;
  fetchedAt: string;
  responses: (Omit<RecordedResponse, "body"> & { file: string })[];
}

export async function writeArchive(
  dir: string,
  fetchedAt: Date,
  recorded: RecordedResponse[],
): Promise<void> {
  const meta: ArchiveMeta = { schemaVersion: 1, fetchedAt: fetchedAt.toISOString(), responses: [] };
  for (const [i, response] of recorded.entries()) {
    const page = new URL(response.url).pathname.split("/").pop() || "index";
    const file = join(response.source, `${String(i).padStart(2, "0")}-${page}`);
    await mkdir(join(dir, response.source), { recursive: true });
    await writeFile(join(dir, file), response.body);
    meta.responses.push({
      source: response.source,
      url: response.url,
      status: response.status,
      error: response.error,
      file,
    });
  }
  await writeFile(join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
}

/** A fetcher that answers each URL with its recorded responses, in the original order. */
export async function readArchive(dir: string): Promise<{ fetchedAt: Date; fetcher: PageFetcher }> {
  const meta = JSON.parse(await readFile(join(dir, "meta.json"), "utf8")) as ArchiveMeta;
  if (meta.schemaVersion !== 1) throw new Error(`${dir}: unknown archive version`);
  const queues = new Map<string, ArchiveMeta["responses"]>();
  for (const response of meta.responses) {
    queues.set(response.url, [...(queues.get(response.url) ?? []), response]);
  }
  const fetcher: PageFetcher = {
    async get(url: string): Promise<FetchResult> {
      const response = queues.get(url)?.shift();
      if (!response) throw new Error(`${dir}: no recorded response for ${url}`);
      return {
        url,
        finalUrl: url,
        status: response.status,
        error: response.error,
        body: await readFile(join(dir, response.file), "utf8"),
        attempts: 1,
        durationMs: 0,
      };
    },
  };
  return { fetchedAt: new Date(meta.fetchedAt), fetcher };
}
