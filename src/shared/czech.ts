/** Marker for a dash cell on a volumes page: the dam has no such zone. */
export const NOT_DEFINED = "undefined-zone" as const;

export type CellValue = number | null | typeof NOT_DEFINED;

const NUMBER = /^[+-]?\d{1,3}(?:[ \u00a0\u202f]?\d{3})*(?:,\d+)?$|^[+-]?\d+(?:,\d+)?$/;
const DASHES = new Set(["-", "–", "—"]);

/**
 * Reads a number written the Czech way: decimal comma, optional space, non-breaking space or
 * narrow no-break space between thousands. A blank cell is `null` (not measured).
 * Throws on anything else, so a layout change cannot slip through as a wrong number.
 */
export function parseCzechNumber(text: string): number | null {
  const value = text.trim();
  if (value === "") return null;
  if (!NUMBER.test(value)) throw new Error(`not a Czech number: ${JSON.stringify(text)}`);
  return Number(value.replace(/[ \u00a0\u202f]/g, "").replace(",", "."));
}

/** Like parseCzechNumber, but a dash means the zone is not defined for this dam. */
export function parseZoneCell(text: string): CellValue {
  return DASHES.has(text.trim()) ? NOT_DEFINED : parseCzechNumber(text);
}

const DATE_TIME = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{1,2}):(\d{2})$/;

/**
 * Reads "22.11.2026 10:10" as Europe/Prague wall-clock time and returns ISO 8601 with the UTC
 * offset in force at that moment ("2026-11-22T10:10:00+01:00"). A blank cell is `null`.
 * In the repeated hour when summer time ends, the earlier (summer-time) moment is chosen.
 */
export function parsePragueDateTime(text: string): string | null {
  const value = text.trim().replace(/\s+/g, " ");
  if (value === "") return null;
  const match = DATE_TIME.exec(value);
  if (!match) throw new Error(`not a Czech date and time: ${JSON.stringify(text)}`);
  const [, d, mo, y, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) {
    throw new Error(`date or time out of range: ${JSON.stringify(text)}`);
  }

  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Try the offsets in force an hour either side and keep one that maps back to this wall time.
  const candidates = [wallAsUtc - 3 * 3600_000, wallAsUtc + 3600_000].map(pragueOffsetMinutes);
  for (const offset of [...new Set(candidates)].sort((a, b) => b - a)) {
    const instant = wallAsUtc - offset * 60_000;
    if (pragueOffsetMinutes(instant) === offset) return format(y, mo, d, h, mi, offset);
  }
  // A wall time skipped when summer time starts (02:00–02:59 on the last Sunday of March).
  throw new Error(`time does not exist in Prague: ${JSON.stringify(text)}`);
}

function pragueOffsetMinutes(instant: number): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Prague",
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(instant))
    .find((part) => part.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? "");
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

function format(y: number, mo: number, d: number, h: number, mi: number, offset: number): string {
  const two = (n: number) => String(n).padStart(2, "0");
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${y}-${two(mo)}-${two(d)}T${two(h)}:${two(mi)}:00${sign}${two(Math.floor(abs / 60))}:${two(abs % 60)}`;
}
