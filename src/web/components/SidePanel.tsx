import { StationCard } from "./StationCard.tsx";
import { formatPct } from "../format.ts";
import {
  shownFill,
  statusLabel,
  statusLower,
  statusVars,
  type View,
  type ViewStation,
} from "../model.ts";

export type Tab = "detail" | "list";

export interface SidePanelProps {
  /** Phone layout: shorter tab labels and a tap hint. */
  phone: boolean;
  view: View;
  tab: Tab;
  onTab: (tab: Tab) => void;
  selected: ViewStation | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

export function SidePanel({
  phone,
  view,
  tab,
  onTab,
  selected,
  hoveredId,
  onHover,
  onSelect,
}: SidePanelProps) {
  return (
    <aside class="side-panel" aria-label="Detail a seznam nádrží">
      <div class="tabs" role="group" aria-label="Zobrazení panelu">
        <button type="button" aria-pressed={tab === "detail"} onClick={() => onTab("detail")}>
          {phone ? "Detail" : "Detail nádrže"}
        </button>
        <button type="button" aria-pressed={tab === "list"} onClick={() => onTab("list")}>
          {phone ? "Seznam" : "Všechny nádrže"} ({view.stations.length})
        </button>
      </div>
      {/* Screen readers hear only the name and status when the selection changes. */}
      <p class="visually-hidden" aria-live="polite">
        {selected ? `${selected.name}: ${statusLabel(selected.status)}` : ""}
      </p>
      {tab === "detail" ? (
        selected ? (
          <StationCard station={selected} />
        ) : (
          <p class="empty-card">Vyberte nádrž na mapě nebo v seznamu.</p>
        )
      ) : (
        <StationList
          phone={phone}
          view={view}
          selectedId={selected?.id ?? null}
          hoveredId={hoveredId}
          onHover={onHover}
          onSelect={onSelect}
        />
      )}
    </aside>
  );
}

function StationList({
  phone,
  view,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
}: {
  phone: boolean;
  view: View;
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div class="list">
      <p class="hint">
        {phone
          ? "Klepnutím na nádrž otevřete její detail."
          : "Najetím na název nádrž na mapě zvýrazníte, kliknutím otevřete její detail."}
      </p>
      <div class="list-scroll">
        {view.groups.map((group) => (
          <section key={group.basin} class="group" aria-labelledby={`group-${group.basin}`}>
            <h2 id={`group-${group.basin}`}>
              <span>{group.title}</span>
              <span class="num">{group.stations.length}</span>
            </h2>
            {group.stations.map((s) => {
              const fill = shownFill(s);
              const outside =
                s.status === "planned" || s.status === "no-data" || s.status === "level-only";
              return (
                <button
                  key={s.id}
                  type="button"
                  class={`row${s.id === hoveredId ? " hovered" : ""}${s.id === selectedId ? " selected" : ""}`}
                  style={statusVars(s.status)}
                  aria-pressed={s.id === selectedId}
                  onMouseEnter={() => onHover(s.id)}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(s.id)}
                  onBlur={() => onHover(null)}
                  onClick={() => onSelect(s.id)}
                >
                  <span class="dot" aria-hidden="true" />
                  <span style={{ minWidth: 0 }}>
                    <span class="name">{s.name}</span>
                    <span class="meta">
                      {outside ? `${s.river} · ${statusLower(s.status)}` : s.river}
                    </span>
                  </span>
                  <span class="bar" aria-hidden="true">
                    <span
                      style={{ width: `${fill === null ? 0 : Math.min(100, Math.max(0, fill))}%` }}
                    />
                  </span>
                  {/* The visible text is the accessible name (WCAG 2.5.3); colour alone shows
                      the status of a rated station, so screen readers get it in words. */}
                  <span class="pct" aria-hidden={fill === null ? "true" : undefined}>
                    {formatPct(fill)}
                  </span>
                  {outside ? null : <span class="visually-hidden">, {statusLower(s.status)}</span>}
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
