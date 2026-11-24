// @vitest-environment happy-dom
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";
import { NBSP } from "./format.ts";
import { buildLatest } from "../derive/latest.ts";
import { collect, type PageFetcher } from "../scraper/collect.ts";
import { loadRegistry } from "../scraper/output.ts";
import { SOURCES } from "../scraper/sources.ts";
import type { Latest } from "../shared/latest.ts";
import type { OverridesFile, StationsFile } from "../shared/registry.ts";
import type { Snapshot } from "../shared/snapshot.ts";

const root = join(import.meta.dirname, "../..");
const now = new Date("2026-11-22T11:00:00+01:00");
let latest: Latest;
let geometry: string;
let registry: StationsFile;
let overrides: OverridesFile;
let today: Snapshot;

const fixtures: PageFetcher = {
  async get(url) {
    const source = SOURCES.find((s) => url.startsWith(new URL("/", s.baseUrl).href))!;
    const page = url.endsWith("Prehled.aspx")
      ? "overview"
      : url.endsWith("Objemy.aspx")
        ? "volumes"
        : null;
    const body = page
      ? await readFile(join(root, "test/fixtures", source.code, `${page}.html`), "utf8")
      : "";
    return {
      url,
      finalUrl: url,
      status: page ? 200 : 404,
      body,
      error: null,
      attempts: 1,
      durationMs: 0,
    };
  },
};

beforeAll(async () => {
  ({ registry, overrides } = await loadRegistry(join(root, "registry")));
  const result = await collect({
    fetcher: fixtures,
    registry,
    overrides,
    now,
    sleep: async () => {},
  });
  if (!result.ok) throw new Error(result.reason);
  today = result.snapshot;
  latest = buildLatest({ registry, overrides, snapshots: [today], now });
  geometry = await readFile(join(root, "public/map/geometry.json"), "utf8");
});

beforeEach(() => {
  history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", async () => new Response(geometry));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderApp = async (data: Latest = latest, at: Date = now) => {
  render(<App load={async () => data} now={() => at} />);
  await screen.findByRole("heading", { level: 1 });
};
const text = (el: Element) =>
  (el.textContent ?? "").replaceAll(NBSP, " ").replace(/\s+/g, " ").trim();

describe("App", () => {
  it("leads with the count of reservoirs above 70 % (national-summary spec)", async () => {
    await renderApp();
    expect(text(screen.getByRole("heading", { level: 1 }))).toMatch(
      /^V \d+ z 117 nádrží je zásoba vody nad 70 %$/,
    );
    expect(screen.getByText(/Souhrnná naplněnost zásobních prostorů je \d+ %\./)).toBeTruthy();
    const chips = within(
      screen.getByRole("list", { name: "Počty nádrží podle stavu" }),
    ).getAllByRole("listitem");
    expect(chips.map(text).map((t) => t.replace(/^\d+ /, ""))).toEqual([
      "nad zásobní hladinou",
      "vysoká zásoba",
      "střední zásoba",
      "nízká zásoba",
      "mimo hodnocení",
    ]);
  });

  it("lists every station grouped by Povodí (station-list spec)", async () => {
    await renderApp();
    expect(
      screen.getByRole("button", { name: "Všechny nádrže" }).getAttribute("aria-pressed"),
    ).toBe("true");
    const groups = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => text(h).replace(/\d+$/, "").trim());
    expect(groups).toEqual([
      "Povodí Vltavy",
      "Povodí Labe",
      "Povodí Ohře",
      "Povodí Moravy",
      "Povodí Odry",
    ]);
  });

  it("opens a station's card from the list and puts it in the URL", async () => {
    await renderApp();
    fireEvent.click(screen.getAllByRole("button", { name: /^VD Slezská Harta/ }).at(-1)!);
    await screen.findByRole("heading", { level: 2, name: "VD Slezská Harta" });
    expect(screen.getByRole("button", { name: "Detail nádrže" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(text(document.querySelector(".main-line")!)).toBe("Hladina je 4,9 m pod plnou hladinou");
    expect(
      screen.getByRole("link", { name: "Živá data na webu Povodí" }).getAttribute("href"),
    ).toBe("https://www.pod.cz/portal/Nadrze/cz/pc/Mereni.aspx?id=300021251&oid=1");
    expect(location.search).toBe("?stanice=pod-slezska-harta");
    // Screen readers hear only the name and status (site-accessibility spec).
    expect(text(document.querySelector("[aria-live]")!)).toBe("VD Slezská Harta: Vysoká zásoba");
  });

  it("opens a shared link with its station selected (spec: Open a shared link)", async () => {
    history.replaceState(null, "", "/?stanice=poh-flaje");
    await renderApp();
    await screen.findByRole("heading", { level: 2, name: "VD Fláje" });
    expect(
      screen.getByText(
        "Data z Povodí Ohře zatím nestahujeme. Aktuální stav najdete na webu Povodí.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Aktuální hladinu neznáme")).toBeTruthy();
  });

  it("ignores an unknown station id (spec: Unknown station id)", async () => {
    history.replaceState(null, "", "/?stanice=neexistuje");
    await renderApp();
    // No station card is open.
    expect(document.getElementById("card-title")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Všechny nádrže" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("draws a circle for every placed station", async () => {
    await renderApp();
    await waitFor(() => expect(document.querySelectorAll(".resbtn").length).toBeGreaterThan(100));
    const placed = latest.stations.filter((s) => s.desktop !== null).length;
    expect(document.querySelectorAll(".resbtn")).toHaveLength(placed);
  });

  it("states that the site is unofficial and names the sources (data-transparency spec)", async () => {
    await renderApp();
    const footer = text(screen.getByRole("contentinfo"));
    expect(footer).toContain("Povodí Vltavy, Labe, Ohře, Moravy a Odry");
    expect(footer).toContain("Neoficiální projekt");
    expect(footer).toContain("bez záruky");
  });
});

describe("App states (tasks 8.6)", () => {
  it("shows a skeleton, not numbers, while the data loads (spec: Slow connection)", () => {
    render(<App load={() => new Promise<Latest>(() => {})} now={() => now} />);
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d+ %/);
  });

  it("warns that the data is out of date and greys every station (spec: Old data)", async () => {
    const later = new Date(now.getTime() + 40 * 3600_000);
    await renderApp(latest, later);
    expect(text(screen.getAllByRole("status")[0]!)).toMatch(
      /^Data nejsou aktuální: poslední úspěšné stažení proběhlo 22\. 11\. 2026, \d+:\d\d\./,
    );
    expect(text(screen.getByRole("heading", { level: 1 }))).toBe(
      "Aktuální data nejsou k dispozici.",
    );
  });

  it("shows a notice and no numbers before the first collection (spec: Before the first collection)", async () => {
    const empty = buildLatest({ registry, overrides, snapshots: [], now });
    await renderApp(empty);
    expect(screen.getByText(/^Data zatím nejsou k dispozici\./)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Počty nádrží podle stavu" })).toBeNull();
    expect(screen.queryByText(/Souhrnná naplněnost/)).toBeNull();
  });

  it("keeps last known values when a source failed today (spec: Source failed)", async () => {
    const shift = (iso: string | null) =>
      iso === null ? null : new Date(Date.parse(iso) - 24 * 3600_000).toISOString();
    const yesterday: Snapshot = {
      ...today,
      date: "2026-11-21",
      fetchedAt: shift(today.fetchedAt)!,
      stations: Object.fromEntries(
        Object.entries(today.stations).map(([id, s]) => [
          id,
          { ...s, measuredAt: shift(s.measuredAt) },
        ]),
      ),
    };
    const failed: Snapshot = {
      ...today,
      sources: { ...today.sources, pla: "failed" },
      sourceReasons: { ...today.sourceReasons, pla: "HTTP 503" },
      stations: Object.fromEntries(
        Object.entries(today.stations).filter(([id]) => !id.startsWith("pla-")),
      ),
    };
    const data = buildLatest({ registry, overrides, snapshots: [yesterday, failed], now });
    history.replaceState(null, "", "/?stanice=pla-bedrichov");
    await renderApp(data);
    await screen.findByRole("heading", { level: 2, name: "Bedřichov" });
    expect(
      screen.getByText(
        /^Dnešní měření se nepodařilo načíst\. Poslední známé hodnoty jsou z 21\. 11\. 2026\.$/,
      ),
    ).toBeTruthy();
    expect(text(document.querySelector(".values")!)).toContain("773,64 m n. m.");
    expect(text(document.querySelector(".source p")!)).toMatch(/poslední měření 21\. 11\. 2026/);
  });

  it("says the change since yesterday is unknown on the first day (spec: First day)", async () => {
    history.replaceState(null, "", "/?stanice=pod-slezska-harta");
    await renderApp();
    await screen.findByRole("heading", { level: 2, name: "VD Slezská Harta" });
    expect(screen.getByText("Změnu od včerejška neznáme")).toBeTruthy();
  });
});
