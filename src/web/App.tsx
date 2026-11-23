import { useEffect, useMemo, useState } from "preact/hooks";
import { STATION_PARAM, loadLatest, pageNow } from "./data.ts";
import { formatDateTime } from "./format.ts";
import { buildView } from "./model.ts";
import { usePhone } from "./usePhone.ts";
import { Footer } from "./components/Footer.tsx";
import { Header } from "./components/Header.tsx";
import { Hero } from "./components/Hero.tsx";
import { MapPanel } from "./components/MapPanel.tsx";
import { SidePanel, type Tab } from "./components/SidePanel.tsx";
import { Skeleton } from "./components/Skeleton.tsx";
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
  const phone = usePhone();

  const select = (id: string, from: "map" | "list" = "map") => {
    setSelectedId(id);
    setHoveredId(null);
    setTab("detail");
    // A list row disappears when the card replaces the list; keep keyboard users in the card.
    if (from === "list")
      requestAnimationFrame(() => document.getElementById("card-title")?.focus());
    // Replace, not push: the back button leaves the site instead of stepping through selections.
    const url = new URL(location.href);
    url.searchParams.set(STATION_PARAM, id);
    history.replaceState(null, "", url);
  };

  return (
    <div class="page">
      <Header lastSuccessfulFetch={view?.lastSuccessfulFetch ?? null} />
      {error && <p class="notice">Data se nepodařilo načíst. Zkuste stránku obnovit.</p>}
      {!view && !error && <Skeleton />}
      {view?.lastSuccessfulFetch === null && (
        // Before the first collection: no numbers at all (data-transparency spec).
        <p class="notice" role="status">
          Data zatím nejsou k dispozici. Mapa se naplní po prvním stažení dat z webů Povodí.
        </p>
      )}
      {view?.lastSuccessfulFetch && view.stale && (
        <p class="notice stale" role="status">
          Data nejsou aktuální: poslední úspěšné stažení proběhlo{" "}
          {formatDateTime(view.lastSuccessfulFetch)}. Hodnoty mohou být zastaralé.
        </p>
      )}
      {view && (
        <>
          <Hero
            headline={view.headline}
            hasData={view.lastSuccessfulFetch !== null}
            phone={phone}
          />
          <div class="main">
            <MapPanel
              phone={phone}
              stations={view.stations}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              onSelect={select}
            />
            <SidePanel
              phone={phone}
              view={view}
              tab={tab}
              onTab={setTab}
              selected={selectedId ? (view.byId.get(selectedId) ?? null) : null}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              onSelect={(id) => select(id, "list")}
            />
          </div>
        </>
      )}
      <Footer />
    </div>
  );
}
