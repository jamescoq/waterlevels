import { useEffect, useMemo, useState } from "preact/hooks";
import { STATION_PARAM, loadLatest, pageNow } from "./data.ts";
import { buildView } from "./model.ts";
import { Footer } from "./components/Footer.tsx";
import { Header } from "./components/Header.tsx";
import { Hero } from "./components/Hero.tsx";
import { MapPanel } from "./components/MapPanel.tsx";
import { SidePanel, type Tab } from "./components/SidePanel.tsx";
import type { Latest } from "../shared/latest.ts";

export function App({
  load = loadLatest,
  now = pageNow,
}: {
  load?: () => Promise<Latest>;
  now?: () => Date;
}) {
  const [latest, setLatest] = useState<Latest | null>(null);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("list");

  useEffect(() => {
    load().then(
      (data) => {
        setLatest(data);
        const wanted = new URLSearchParams(location.search).get(STATION_PARAM);
        // An unknown id selects nothing and shows no error (station-detail spec).
        if (wanted && data.stations.some((s) => s.id === wanted)) {
          setSelectedId(wanted);
          setTab("detail");
        }
      },
      () => setError(true),
    );
  }, [load]);

  const view = useMemo(() => (latest ? buildView(latest, now()) : null), [latest, now]);

  const select = (id: string) => {
    setSelectedId(id);
    setHoveredId(null);
    setTab("detail");
    // Replace, not push: the back button leaves the site instead of stepping through selections.
    const url = new URL(location.href);
    url.searchParams.set(STATION_PARAM, id);
    history.replaceState(null, "", url);
  };

  return (
    <div class="page">
      <Header lastSuccessfulFetch={view?.lastSuccessfulFetch ?? null} />
      {error && <p class="load-error">Data se nepodařilo načíst. Zkuste stránku obnovit.</p>}
      {!view && !error && <p class="loading">Načítám data…</p>}
      {view && (
        <>
          <Hero headline={view.headline} />
          <div class="main">
            <MapPanel
              stations={view.stations}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              onSelect={select}
            />
            <SidePanel
              view={view}
              tab={tab}
              onTab={setTab}
              selected={selectedId ? (view.byId.get(selectedId) ?? null) : null}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              onSelect={select}
            />
          </div>
        </>
      )}
      <Footer />
    </div>
  );
}
