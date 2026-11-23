/**
 * Schematic dam section (station-detail spec, "Dam cut-through"; design brief §5). Not to scale:
 * the three levels sit at fixed heights, and the water line is placed between them by the
 * measured level.
 */
import { czNumber } from "../format.ts";
import { STATUS_STYLE, type ViewStation } from "../model.ts";

/** Desktop geometry in px from the top (brief §5). */
const G = { crest: 14, maxRet: 38, full: 66, dead: 168, bottom: 210, damWidth: 96, inset: 80 };

const WAVE =
  "M0,4 C14.5,0 43.5,0 58,4 S101.5,8 116,4 S159.5,0 174,4 S217.5,8 232,4 S275.5,0 290,4 S333.5,8 348,4 S391.5,0 406,4 S449.5,8 464,4 S507.5,0 522,4 S565.5,8 580,4 S623.5,0 638,4 S681.5,8 696,4";

/** y of the water line for a level, between the fixed level lines (brief §5, "Level → y"). */
export function waterTop(
  level: number,
  levels: { maxRetention: number | null; storage: number | null; permanent: number | null },
): number | null {
  const { permanent: dead } = levels;
  const full = levels.storage ?? levels.maxRetention;
  if (dead === null || full === null || full <= dead) return null;
  const maxRet =
    levels.maxRetention !== null && levels.maxRetention > full ? levels.maxRetention : null;
  let y: number;
  if (level >= full) {
    const above = maxRet === null ? 0 : Math.min(1, (level - full) / (maxRet - full));
    y = G.full - above * (G.full - G.maxRet);
  } else {
    y = G.dead - Math.max(-0.25, (level - dead) / (full - dead)) * (G.dead - G.full);
  }
  return Math.round(Math.min(G.bottom - 6, Math.max(G.crest + 6, y)));
}

export function CutThrough({ station: s }: { station: ViewStation }) {
  const noData = s.status === "no-data";
  const top = !noData && s.level !== null ? waterTop(s.level, s.levels) : null;
  const shown = top !== null;
  const pillTop = shown ? Math.max(4, top - 26) : G.dead - 60;
  const crestY = (G.crest * 200) / G.bottom;
  const label = (value: number | null) => (value === null ? "" : czNumber(value, 2));

  const lines = [
    {
      y: G.maxRet,
      value: s.levels.maxRetention,
      text: "Max. hladina",
      line: "rgba(183,156,255,0.55)",
      color: "#D9CCFF",
    },
    {
      y: G.full,
      value: s.levels.storage,
      text: "Plná zásoba",
      line: "rgba(189,235,255,0.55)",
      color: "#D6F1FF",
    },
    {
      y: G.dead,
      value: s.levels.permanent,
      text: "Stálé nadržení",
      line: "rgba(157,176,198,0.45)",
      color: "#C9D8EA",
    },
  ].filter((l) => l.value !== null);

  return (
    <figure class="cut" style={{ margin: 0 }}>
      <div class="cut-box" style={{ height: `${G.bottom}px` }} aria-hidden="true">
        <span
          style={{
            left: 0,
            right: `${G.inset + 4}px`,
            top: `${G.maxRet}px`,
            height: `${G.full - G.maxRet}px`,
            background: "rgba(183,156,255,0.08)",
          }}
        />
        <span
          style={{
            left: 0,
            right: `${G.inset + 4}px`,
            top: `${G.full}px`,
            height: `${G.dead - G.full}px`,
            background: "rgba(61,185,242,0.035)",
          }}
        />
        <div
          class="water"
          style={{
            right: `${G.inset}px`,
            top: `${shown ? top : G.bottom}px`,
            opacity: shown ? 1 : 0,
          }}
        >
          <div class="wave-strip">
            <svg class="back" viewBox="0 0 696 8" preserveAspectRatio="none">
              <path d={`${WAVE} L696,8 L0,8 Z`} fill="#7FD0FA" />
            </svg>
            <svg class="front" viewBox="0 0 696 8" preserveAspectRatio="none">
              <path d={`${WAVE} L696,8 L0,8 Z`} fill="rgba(61,185,242,0.72)" />
              <path
                d={WAVE}
                fill="none"
                stroke="#BDEBFF"
                stroke-width="1.2"
                vector-effect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>
        <svg
          viewBox="0 0 300 60"
          preserveAspectRatio="none"
          style={{ left: 0, bottom: 0, width: `calc(100% - ${G.inset}px)`, height: "63px" }}
        >
          <path d="M0,10 C70,16 130,40 210,52 L300,57 L300,60 L0,60 Z" fill="#0A1726" />
          <path
            d="M0,10 C70,16 130,40 210,52 L300,57"
            fill="none"
            stroke="#2A527B"
            stroke-width="1.2"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        <svg
          viewBox="0 0 96 200"
          preserveAspectRatio="none"
          style={{ right: 0, top: 0, width: `${G.damWidth}px`, height: `${G.bottom}px` }}
        >
          <defs>
            <linearGradient id="dam" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#2B4A6C" />
              <stop offset="1" stop-color="#13263D" />
            </linearGradient>
          </defs>
          <polygon
            points={`10,${crestY} 28,${crestY} 96,200 4,200`}
            fill="url(#dam)"
            stroke="#4A7BAA"
            stroke-width="1"
            vector-effect="non-scaling-stroke"
          />
          <line
            x1="10"
            y1={crestY}
            x2="28"
            y2={crestY}
            stroke="#9DB0C6"
            stroke-width="2"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        {lines.map((l) => (
          <span key={l.text}>
            <span
              class="level-line"
              style={{
                top: `${l.y}px`,
                right: `${G.inset + 2}px`,
                borderColor: l.line,
                position: "absolute",
              }}
            />
            <span
              class="level-label"
              style={{ top: `${l.y - 19}px`, color: l.color, position: "absolute" }}
            >
              {l.text} {label(l.value)}
            </span>
          </span>
        ))}
        <span
          class="level-pill"
          style={{
            right: `${G.inset + 8}px`,
            top: `${pillTop}px`,
            "--c": STATUS_STYLE[s.status].color,
          }}
        >
          {shown && s.level !== null ? `${czNumber(s.level, 2)} m` : "bez dat"}
        </span>
      </div>
      <figcaption class="cut-caption">Schematický řez, výšky v m n. m.</figcaption>
    </figure>
  );
}
