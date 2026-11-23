/** Placeholder while the data loads (site-availability spec, "Loading state"): no numbers. */
export function Skeleton() {
  return (
    <div class="skeleton" aria-busy="true" aria-label="Načítám data">
      <div class="hero">
        <span class="bone" style={{ width: "220px", height: "14px" }} />
        <span class="bone" style={{ width: "min(640px, 90%)", height: "48px" }} />
        <span class="bone" style={{ width: "min(520px, 80%)", height: "18px" }} />
      </div>
      <div class="main">
        <div class="map-panel">
          <span
            class="bone"
            style={{ width: "100%", aspectRatio: "880 / 505", borderRadius: "16px" }}
          />
        </div>
        <div class="side-panel">
          <span class="bone" style={{ width: "100%", height: "52px", borderRadius: "14px" }} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} class="bone" style={{ width: "100%", height: "36px" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
