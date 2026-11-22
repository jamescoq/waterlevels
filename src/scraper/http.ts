import { MIN_REQUEST_GAP_MS, REQUEST_TIMEOUT_MS, RETRY_DELAYS_MS, USER_AGENT } from "./config.ts";

export interface FetchResult {
  url: string;
  /** URL after redirects. */
  finalUrl: string;
  /** HTTP status, or null when no response arrived. */
  status: number | null;
  body: string;
  error: string | null;
  attempts: number;
  durationMs: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sequential, polite fetching: every request carries our User-Agent, requests to one host are
 * at least MIN_REQUEST_GAP_MS apart, and network errors or 5xx responses are retried twice.
 * The full scraper client (tasks 5.1) builds on this.
 */
export class PoliteClient {
  private readonly lastRequestAt = new Map<string, number>();

  constructor(
    private readonly options: {
      userAgent?: string;
      minGapMs?: number;
      timeoutMs?: number;
      retryDelaysMs?: readonly number[];
      fetchImpl?: typeof fetch;
    } = {},
  ) {}

  async get(url: string): Promise<FetchResult> {
    const retryDelays = this.options.retryDelaysMs ?? RETRY_DELAYS_MS;
    const started = Date.now();
    let attempt = 0;
    for (;;) {
      attempt += 1;
      const result = await this.once(url);
      const retryable = result.status === null || result.status >= 500;
      const delay = retryDelays[attempt - 1];
      if (!retryable || delay === undefined) {
        return { ...result, attempts: attempt, durationMs: Date.now() - started };
      }
      await sleep(delay);
    }
  }

  private async once(url: string): Promise<Omit<FetchResult, "attempts" | "durationMs">> {
    const host = new URL(url).host;
    const gap = this.options.minGapMs ?? MIN_REQUEST_GAP_MS;
    const last = this.lastRequestAt.get(host);
    if (last !== undefined) {
      const wait = last + gap - Date.now();
      if (wait > 0) await sleep(wait);
    }
    this.lastRequestAt.set(host, Date.now());

    const fetchImpl = this.options.fetchImpl ?? fetch;
    try {
      const response = await fetchImpl(url, {
        headers: { "User-Agent": this.options.userAgent ?? USER_AGENT, Accept: "text/html,*/*" },
        redirect: "follow",
        signal: AbortSignal.timeout(this.options.timeoutMs ?? REQUEST_TIMEOUT_MS),
      });
      return {
        url,
        finalUrl: response.url || url,
        status: response.status,
        body: await response.text(),
        error: null,
      };
    } catch (err) {
      return {
        url,
        finalUrl: url,
        status: null,
        body: "",
        error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      };
    }
  }
}
