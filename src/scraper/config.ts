/** Product token that robots.txt groups are matched against. */
export const BOT_TOKEN = "stavvody.cz-bot";

/** Project contact for portal operators, also shown in the site footer. */
export const CONTACT_EMAIL = "stavvodycz@gmail.com";

/**
 * Sent with every request to a Povodí portal. The URL points to the public repository until
 * the site's methodology page (https://stavvody.cz/o-datech) is live.
 */
export const USER_AGENT = `${BOT_TOKEN}/0.1 (+https://github.com/jamescoq/waterlevels; ${CONTACT_EMAIL})`;

/** Minimum gap between two requests to the same host. */
export const MIN_REQUEST_GAP_MS = 2_000;

export const REQUEST_TIMEOUT_MS = 30_000;

/** Waits before the first and second retry after a network error or a 5xx response. */
export const RETRY_DELAYS_MS = [5_000, 20_000] as const;
