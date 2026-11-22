import { describe, expect, it } from "vitest";
import { USER_AGENT } from "./config.ts";
import { PoliteClient } from "./http.ts";

type Reply = { status: number; body?: string } | Error;

/** A fake fetch that answers from a script and records each request. */
function fakeFetch(replies: Record<string, Reply[]>) {
  const calls: { url: string; at: number; userAgent: string | null }[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, at: Date.now(), userAgent: new Headers(init?.headers).get("User-Agent") });
    const reply = replies[url]?.shift() ?? { status: 404 };
    if (reply instanceof Error) throw reply;
    return new Response(reply.body ?? "", { status: reply.status });
  }) as typeof fetch;
  return { impl, calls };
}

const client = (
  impl: typeof fetch,
  options: { minGapMs?: number; retryDelaysMs?: number[] } = {},
) => new PoliteClient({ fetchImpl: impl, minGapMs: 0, retryDelaysMs: [0, 0], ...options });

describe("PoliteClient", () => {
  it("sends the project User-Agent", async () => {
    const { impl, calls } = fakeFetch({ "https://a.cz/x": [{ status: 200, body: "ok" }] });
    const result = await client(impl).get("https://a.cz/x");
    expect(result).toMatchObject({ status: 200, body: "ok", attempts: 1, error: null });
    expect(calls[0]?.userAgent).toBe(USER_AGENT);
    expect(USER_AGENT).toMatch(/^stavvody\.cz-bot\/.+stavvodycz@gmail\.com\)$/);
  });

  it("retries a 5xx response twice, then gives up", async () => {
    const { impl, calls } = fakeFetch({
      "https://a.cz/x": [{ status: 503 }, { status: 502 }, { status: 500 }, { status: 200 }],
    });
    const result = await client(impl).get("https://a.cz/x");
    expect(result).toMatchObject({ status: 500, attempts: 3 });
    expect(calls).toHaveLength(3);
  });

  it("retries a network error and succeeds", async () => {
    const { impl } = fakeFetch({
      "https://a.cz/x": [new TypeError("fetch failed"), { status: 200, body: "ok" }],
    });
    expect(await client(impl).get("https://a.cz/x")).toMatchObject({ status: 200, attempts: 2 });
  });

  it("reports a network error that persists without throwing", async () => {
    const err = new TypeError("fetch failed");
    const { impl } = fakeFetch({ "https://a.cz/x": [err, err, err] });
    expect(await client(impl).get("https://a.cz/x")).toMatchObject({
      status: null,
      attempts: 3,
      error: "TypeError: fetch failed",
    });
  });

  it("does not retry a 4xx response", async () => {
    const { impl, calls } = fakeFetch({ "https://a.cz/x": [{ status: 403 }, { status: 200 }] });
    expect(await client(impl).get("https://a.cz/x")).toMatchObject({ status: 403, attempts: 1 });
    expect(calls).toHaveLength(1);
  });

  it("keeps requests to one host apart, but not requests to different hosts", async () => {
    const { impl, calls } = fakeFetch({
      "https://a.cz/1": [{ status: 200 }],
      "https://a.cz/2": [{ status: 200 }],
      "https://b.cz/1": [{ status: 200 }],
    });
    const c = client(impl, { minGapMs: 120 });
    await c.get("https://a.cz/1");
    await c.get("https://b.cz/1");
    await c.get("https://a.cz/2");
    const [a1, b1, a2] = calls;
    expect(b1!.at - a1!.at).toBeLessThan(100);
    expect(a2!.at - a1!.at).toBeGreaterThanOrEqual(115);
  });
});
