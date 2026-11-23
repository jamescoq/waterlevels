/** Czech formatting for numbers, dates and the card's sentences (design brief §5, §9). */

export const NBSP = " ";

/** 491.2 → "491,20" with `decimals` places and a decimal comma. */
export const czNumber = (value: number, decimals: number) =>
  value.toFixed(decimals).replace(".", ",");

/** 82.4 → "82 %" */
export const formatPct = (value: number | null) =>
  value === null ? "–" : `${Math.round(value)}${NBSP}%`;

const pragueParts = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: get("day"),
    month: get("month"),
    year: get("year"),
    hour: get("hour"),
    minute: get("minute"),
  };
};

/** "22. 11. 2026, 7:00" in Prague time. */
export function formatDateTime(iso: string): string {
  const p = pragueParts(iso);
  return `${Number(p.day)}. ${Number(p.month)}. ${p.year}, ${Number(p.hour)}:${p.minute}`;
}

/** "22. 11. 2026" in Prague time. */
export function formatDate(iso: string): string {
  const p = pragueParts(iso);
  return `${Number(p.day)}. ${Number(p.month)}. ${p.year}`;
}

/** "Hladina je 4,8 m pod plnou hladinou"; null when either level is unknown. */
export function levelSentence(level: number | null, storageLevel: number | null): string | null {
  if (level === null || storageLevel === null) return null;
  const diff = level - storageLevel;
  if (Math.abs(diff) < 0.05) return "Hladina je přesně na plné hladině";
  return `Hladina je ${czNumber(Math.abs(diff), 1)}${NBSP}m ${diff < 0 ? "pod" : "nad"} plnou hladinou`;
}

export type Trend = "up" | "down" | "flat" | "unknown";

/** The change since yesterday as a direction and its Czech sentence. */
export function changeText(cm: number | null): { trend: Trend; text: string } {
  if (cm === null) return { trend: "unknown", text: "Změnu od včerejška neznáme" };
  if (cm === 0) return { trend: "flat", text: "Od včerejška beze změny" };
  return cm > 0
    ? { trend: "up", text: `Od včerejška stoupla o ${cm}${NBSP}cm` }
    : { trend: "down", text: `Od včerejška klesla o ${-cm}${NBSP}cm` };
}

/** "491,20 m n. m." */
export const levelText = (level: number | null) =>
  level === null ? "–" : `${czNumber(level, 2)}${NBSP}m${NBSP}n.${NBSP}m.`;

/** "149 z 182 mil. m³"; one decimal when the capacity is under 20. */
export function volumeText(filled: number | null, capacity: number | null): string {
  if (filled === null || capacity === null) return "–";
  const d = capacity < 20 ? 1 : 0;
  return `${czNumber(filled, d)} z ${czNumber(capacity, d)}${NBSP}mil.${NBSP}m³`;
}

/** "2,5 m³/s"; two decimals under 1. */
export const flowText = (value: number | null) =>
  value === null ? "–" : `${czNumber(value, value < 1 ? 2 : 1)}${NBSP}m³/s`;
