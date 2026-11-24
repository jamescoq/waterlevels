/**
 * The map (station-map spec): relief, border, rivers and cities from the build's map assets,
 * one circle per station, labels and a legend. Circle positions come pre-computed in the 880 px
 * frame; they are placed in percentages and sized with container units, so they scale with
 * the panel.
 */
import { useEffect, useState } from "preact/hooks";
import { STATUS_STYLE, shownFill, stationAria, statusVars, type ViewStation } from "../model.ts";
import { formatPct } from "../format.ts";
import type { MapGeometry } from "../../shared/geometry.ts";
import type { Status } from "../../shared/status.ts";

/** Cities with labels, as in the design (brief §3); Ostrava and Liberec label to the left. */
const LABELLED_CITIES: Record<string, { label: string; end?: boolean }> = {
  Praha: { label: "Praha" },
  Brno: { label: "Brno" },
  Ostrava: { label: "Ostrava", end: true },
  Plzeň: { label: "Plzeň" },
  "České Budějovice": { label: "Č. Budějovice" },
  "Hradec Králové": { label: "Hradec Králové" },
  Olomouc: { label: "Olomouc" },
  Liberec: { label: "Liberec", end: true },
};

/** Names always shown for circles at least this large (≈ 60 mil. m³ of storage). */
const LABEL_MIN_DIAMETER = 29;
const MIN_DIAMETER = 18;
const MIN_HIT = 28;
/** Phone map (station-map spec: 10 px minimum on phones); 24 px touch area like the design. */
const PHONE_MIN_DIAMETER = 10;
const PHONE_MIN_HIT = 24;
const PHONE_FRAME_WIDTH = 358;

export interface MapPanelProps {
  /** Phone layout: phone circle positions, no hover preview, fewer labels. */
  phone: boolean;
  stations: ViewStation[];
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

export function MapPanel(props: MapPanelProps) {
  const [geometry, setGeometry] = useState<MapGeometry | null>(null);
  useEffect(() => {
    fetch(`/map/geometry.json?v=${__BUILD_ID__}`)
      .then((r) => (r.ok ? (r.json() as Promise<MapGeometry>) : null))
      .then(setGeometry, () => setGeometry(null));
  }, []);

  return (
    <section class="map-panel" aria-label="Mapa nádrží">
      {geometry ? (
        <MapView geometry={geometry} {...props} />
      ) : (
        <div class="map" style={{ aspectRatio: "880 / 505" }} />
      )}
      <Legend />
      {/* OpenStreetMap and Copernicus ask for the credit where the map is seen; the full
          notices are on the methodology page. */}
      <p class="map-credit">
        Řeky © <a href="https://www.openstreetmap.org/copyright">přispěvatelé OpenStreetMap</a> ·
        reliéf: Copernicus WorldDEM-90 © DLR e.V., Airbus · hranice: Natural Earth ·{" "}
        <a href="/metodika/#licence">mapové podklady</a>
      </p>
    </section>
  );
}

function MapView({
  geometry: g,
  phone,
  stations,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
}: MapPanelProps & { geometry: MapGeometry }) {
  const { width: W, height: H } = g;
  // Circles come pre-placed for the 880 px desktop map and the 358 px phone map; the map's
  // own layers are drawn in the desktop frame and simply scale.
  const frameW = phone ? PHONE_FRAME_WIDTH : W;
  const frameH = (H * frameW) / W;
  const minD = phone ? PHONE_MIN_DIAMETER : MIN_DIAMETER;
  const minHit = phone ? PHONE_MIN_HIT : MIN_HIT;
  const circleOf = (s: ViewStation) => (phone ? s.phone : s.desktop)!;
  /** px in the circles' frame → length that scales with the map's actual width. */
  const scaled = (px: number) => `calc(${px} * 100cqw / ${frameW})`;
  const placed = stations.filter((s) => s.desktop !== null && s.phone !== null);

  return (
    <div class="map" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg class="layers" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="landfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#0D1D30" />
            <stop offset="1" stop-color="#0A1727" />
          </linearGradient>
          <filter id="glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>
        <path
          d={g.border}
          fill="none"
          stroke="#1E4A73"
          stroke-width="9"
          opacity="0.18"
          filter="url(#glow)"
        />
        <path d={g.border} fill="url(#landfill)" />
        <image
          href={phone ? "/map/hillshade-880.webp" : "/map/hillshade-1760.webp"}
          x="0"
          y="0"
          width={W}
          height={H}
          preserveAspectRatio="none"
        />
        <g fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d={g.rivers.feeder} stroke="#4FB3F0" stroke-opacity="0.45" stroke-width="0.66" />
          <path
            d={g.rivers.tributary}
            stroke="#2F8FD6"
            stroke-opacity="0.25"
            stroke-width="3.3"
            filter="url(#glow)"
          />
          <path d={g.rivers.tributary} stroke="#4FB3F0" stroke-opacity="0.62" stroke-width="0.96" />
          <path
            d={g.rivers.main}
            stroke="#2F8FD6"
            stroke-opacity="0.35"
            stroke-width="5"
            filter="url(#glow)"
          />
          <path d={g.rivers.main} stroke="#4FB3F0" stroke-opacity="0.8" stroke-width="1.45" />
        </g>
        <path d={g.border} fill="none" stroke="#3A6A98" stroke-opacity="0.7" stroke-width="1" />
        {g.cities
          .filter((c) => LABELLED_CITIES[c.name])
          .filter(() => !phone)
          .map((c) => {
            const preferred = LABELLED_CITIES[c.name]!;
            // Try the preferred side, then the other; give way if both are taken.
            const city = [preferred, { ...preferred, end: !preferred.end }].find(
              (option) => !collides(cityLabelBox(c, option), placed),
            );
            return (
              <g key={c.name}>
                <circle cx={c.x} cy={c.y} r="2.3" fill="#C9D8EA" opacity="0.55" />
                {city && (
                  <text
                    x={city.end ? c.x - 5 : c.x + 5}
                    y={c.y - 5}
                    text-anchor={city.end ? "end" : "start"}
                    font-size="9.7"
                    fill="#A9BCD2"
                    fill-opacity="0.85"
                    stroke="#0A1727"
                    stroke-width="2.2"
                    stroke-opacity="0.8"
                    paint-order="stroke"
                  >
                    {city.label}
                  </text>
                )}
              </g>
            );
          })}
      </svg>

      {placed.map((s) => {
        const c = circleOf(s);
        const d = Math.max(minD, c.r * 2);
        const size = `max(${minD}px, ${scaled(c.r * 2)})`;
        const hovered = hoveredId === s.id;
        const selected = selectedId === s.id;
        const fill = shownFill(s);
        return (
          <button
            key={s.id}
            type="button"
            class="resbtn"
            aria-label={stationAria(s)}
            aria-pressed={selected}
            style={{
              left: `${(c.x / frameW) * 100}%`,
              top: `${(c.y / frameH) * 100}%`,
              width: `max(${minHit}px, ${size})`,
              height: `max(${minHit}px, ${size})`,
              zIndex: hovered ? 2050 : selected ? 2000 : Math.round(1000 - d),
            }}
            // Phones have no preview (station-map spec, "Preview on desktop").
            onMouseEnter={phone ? undefined : () => onHover(s.id)}
            onMouseLeave={phone ? undefined : () => onHover(null)}
            onFocus={phone ? undefined : () => onHover(s.id)}
            onBlur={phone ? undefined : () => onHover(null)}
            onClick={() => onSelect(s.id)}
          >
            <Disc status={s.status} fill={fill} size={size} hovered={hovered} selected={selected} />
          </button>
        );
      })}

      {placed
        .filter((s) =>
          // On phones only the selected station is named; the map is too small for more.
          phone
            ? s.id === selectedId
            : s.desktop!.r * 2 >= LABEL_MIN_DIAMETER || s.id === selectedId || s.id === hoveredId,
        )
        .map((s) => {
          const c = circleOf(s);
          const hovered = s.id === hoveredId;
          const over = s.status === "above-storage";
          const d = `max(${minD}px, ${scaled(c.r * 2)})`;
          const offset = `calc(${d} / 2 + ${5 + (over ? 5 : 0)}px${hovered ? ` + ${d} * 0.125` : ""})`;
          return (
            <span
              key={`label-${s.id}`}
              class={`map-label${hovered ? " hovered" : ""}${s.id === selectedId ? " selected" : ""}`}
              aria-hidden="true"
              style={{
                left: `${(c.x / frameW) * 100}%`,
                top: `${(c.y / frameH) * 100}%`,
                transform: `translate(-50%, ${offset})`,
              }}
            >
              {hovered ? `${s.name} · ${formatPct(shownFill(s))}` : s.name}
            </span>
          );
        })}
    </div>
  );
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Approximate box of a city label in frame px (9.7 px Inter averages ~5.4 px per character). */
export function cityLabelBox(
  c: { x: number; y: number },
  city: { label: string; end?: boolean },
): Box {
  const width = city.label.length * 5.4;
  const left = city.end ? c.x - 5 - width : c.x + 5;
  return { left, right: left + width, top: c.y - 14, bottom: c.y - 3 };
}

/**
 * City labels give way (station-map spec, "Labels"): hidden where they would overlap a circle
 * or the name always shown below a large circle.
 */
export function collides(box: Box, stations: Pick<ViewStation, "name" | "desktop">[]): boolean {
  return stations.some((s) => {
    const c = s.desktop!;
    const r = Math.max(MIN_DIAMETER / 2, c.r) + 1;
    const nearX = Math.max(box.left, Math.min(c.x, box.right));
    const nearY = Math.max(box.top, Math.min(c.y, box.bottom));
    if (Math.hypot(c.x - nearX, c.y - nearY) < r) return true;
    if (c.r * 2 < LABEL_MIN_DIAMETER) return false;
    const half = (s.name.length * 6.3) / 2;
    const label = {
      left: c.x - half,
      right: c.x + half,
      top: c.y + c.r + 4,
      bottom: c.y + c.r + 18,
    };
    return (
      label.left < box.right &&
      box.left < label.right &&
      label.top < box.bottom &&
      box.top < label.bottom
    );
  });
}

function Disc({
  status,
  fill,
  size,
  hovered,
  selected,
}: {
  status: Status;
  fill: number | null;
  size: string;
  hovered: boolean;
  selected: boolean;
}) {
  const { rgb, color } = STATUS_STYLE[status];
  const over = status === "above-storage";
  const noData = status === "no-data";
  // Built up as in the design (brief §3): glow, double outline, selection ring, hover glow.
  const shadows = [`0 0 14px rgba(${rgb}, ${noData ? 0 : 0.45})`];
  let edge = 0;
  if (over) {
    shadows.push(`0 0 0 2.5px #050B16`, `0 0 0 4.5px ${color}`);
    edge = 4.5;
  }
  if (selected) shadows.push(`0 0 0 ${edge + 3}px #050B16`, `0 0 0 ${edge + 5}px #E8F1FB`);
  if (hovered) shadows.push(`0 0 24px 8px rgba(${rgb}, 0.7)`);
  return (
    <>
      {over && <span class="pulse" style={{ ...statusVars(status), width: size, height: size }} />}
      <span
        class={`disc${noData ? " dashed" : ""}`}
        style={{
          ...statusVars(status),
          width: size,
          height: size,
          boxShadow: shadows.join(", "),
          transform: hovered ? "scale(1.25)" : undefined,
        }}
      >
        {fill !== null && (
          <span class="fill" style={{ height: `${Math.min(100, Math.max(0, fill))}%` }} />
        )}
        {status === "level-only" && <span class="centre" />}
      </span>
    </>
  );
}

const LEGEND: {
  status: Status;
  title: string;
  sub: string;
  kind?: "over" | "dashed" | "level-only";
}[] = [
  {
    status: "above-storage",
    title: "Nad zásobní hladinou",
    sub: "voda v retenčním prostoru",
    kind: "over",
  },
  { status: "high", title: "Vysoká zásoba", sub: "70 % a více" },
  { status: "medium", title: "Střední zásoba", sub: "40–70 %" },
  { status: "low", title: "Nízká zásoba", sub: "pod 40 %" },
  { status: "planned", title: "Plánované snížení", sub: "záměr správce, nejde o sucho" },
  { status: "level-only", title: "Jen hladina", sub: "naplnění se neuvádí", kind: "level-only" },
  { status: "no-data", title: "Bez dat", sub: "měření se nenačetlo", kind: "dashed" },
];

function Legend() {
  return (
    <ul class="legend" aria-label="Legenda">
      {LEGEND.map((item) => (
        <li key={item.status}>
          <span
            class={`swatch${item.kind ? ` ${item.kind}` : ""}`}
            style={statusVars(item.status)}
            aria-hidden="true"
          />
          <span>
            <span class="title">{item.title}</span>
            <span class="sub">{item.sub}</span>
          </span>
        </li>
      ))}
      <li>
        <span class="size-key" aria-hidden="true">
          <span style={{ width: "12px", height: "12px" }} />
          <span style={{ width: "20px", height: "20px" }} />
          <span style={{ width: "30px", height: "30px" }} />
        </span>
        <span>Velikost kruhu = objem zásobního prostoru</span>
      </li>
    </ul>
  );
}
