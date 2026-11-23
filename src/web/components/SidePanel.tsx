import { StationCard } from "./StationCard.tsx";
import { formatPct } from "../format.ts";
import {
  shownFill,
  stationAria,
  statusLabel,
  statusLower,
  statusVars,
  type View,
  type ViewStation,
} from "../model.ts";

export type Tab = "detail" | "list";

export interface SidePanelProps {
  view: View;
  tab: Tab;
  onTab: (tab: Tab) => void;
  selected: ViewStation | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

export function SidePanel({
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
          Detail nádrže
        </button>
        <button type="button" aria-pressed={tab === "list"} onClick={() => onTab("list")}>
          Všechny nádrže ({view.stations.length})
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
  view,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
}: {
  view: View;
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div class="list">
      <p class="hint">Najetím na název nádrž na mapě zvýrazníte, kliknutím otevřete její detail.</p>
      <div class="list-scroll">
        {view.groups.map((group) => (
          <section key={group.basin} class="group" aria-labelledby={`group-${group.basin}`}>
            <h3 id={`group-${group.basin}`}>
              <span>{group.title}</span>
              <span class="num">{group.stations.length}</span>
            </h3>
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
                  aria-label={stationAria(s)}
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
                  <span class="pct">{formatPct(fill)}</span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
