/** Inline icons from the design (brief §10). Decorative: hidden from assistive technology. */
import type { JSX } from "preact";

const stroke = (size: number, width: number, paths: string[]) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={width}
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {paths.map((d) => (
      <path key={d} d={d} />
    ))}
  </svg>
);

export const Logo = (): JSX.Element => (
  <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" focusable="false">
    <circle cx="17" cy="17" r="16" fill="#0B1828" stroke="#3DB9F2" stroke-width="1.5" />
    <path
      d="M5 19 C9 16.5 13 16.5 17 19 S25 21.5 29 19 L29 22 C28 27 23 31 17 31 C11 31 6 27 5 22 Z"
      fill="#3DB9F2"
    />
    <path
      d="M5 19 C9 16.5 13 16.5 17 19 S25 21.5 29 19"
      fill="none"
      stroke="#BDEBFF"
      stroke-width="1.2"
    />
  </svg>
);

export const LevelIcon = () => stroke(18, 1.8, ["M12 3v18", "M8 7l4-4 4 4", "M8 17l4 4 4-4"]);
export const InfoIcon = () =>
  stroke(16, 2, ["M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18", "M12 11v6", "M12 7.5v.5"]);
export const UpIcon = () => stroke(16, 2, ["M12 19V5", "M5 12l7-7 7 7"]);
export const DownIcon = () => stroke(16, 2, ["M12 5v14", "M19 12l-7 7-7-7"]);
export const FlatIcon = () => stroke(16, 2, ["M5 12h14"]);
export const ExternalIcon = () =>
  stroke(14, 2, [
    "M14 4h6v6",
    "M20 4l-9 9",
    "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  ]);
export const LinkIcon = () =>
  stroke(14, 2, [
    "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1",
    "M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  ]);
