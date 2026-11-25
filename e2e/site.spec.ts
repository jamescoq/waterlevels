import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** The fixture data is from 22 November 2026; freeze the page's clock on that day. */
const FIXTURE_DAY = new Date("2026-11-22T12:00:00+01:00");

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_DAY);
});

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1000) < 640;

const openList = async (page: Page) => {
  const listTab = page.getByRole("button", { name: /^(Všechny nádrže|Seznam)$/ });
  if ((await listTab.getAttribute("aria-pressed")) !== "true") await listTab.click();
};

const selectFromList = async (page: Page, name: RegExp) => {
  await openList(page);
  await page.locator(".row").filter({ hasText: name }).first().click();
};

test.describe("shared links (station-detail spec, tasks 8.7)", () => {
  test("open with the station selected", async ({ page }) => {
    await page.goto("/?stanice=pod-slezska-harta");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("VD Slezská Harta");
  });

  test("ignore an unknown station without an error page", async ({ page }) => {
    const response = await page.goto("/?stanice=neexistuje");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // No station card is open.
    await expect(page.locator("#card-title")).toHaveCount(0);
  });

  test("the back button leaves the site instead of stepping through selections", async ({
    page,
  }) => {
    await page.goto("data:text/html,<title>start</title>start");
    await page.goto("/");
    for (const name of [/Slezská Harta/, /Lipno 1/, /Orlík/, /Vranov/, /Rozkoš/]) {
      await selectFromList(page, name);
      await expect(page.getByRole("heading", { level: 2 })).toHaveText(name);
    }
    expect(page.url()).toContain("stanice=pla-rozkos");
    await page.goBack();
    expect(page.url()).toMatch(/^data:text\/html/);
  });
});

test.describe("keyboard use (site-accessibility spec, tasks 8.9)", () => {
  test("select a station, switch tabs and reach the links with the keyboard alone", async ({
    page,
  }) => {
    await page.goto("/");
    // Tab until a station circle or list row has focus, then open it with Enter.
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => document.activeElement?.className ?? "");
      if (/\b(resbtn|row)\b/.test(focused)) break;
    }
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(page.locator(":focus-visible, :focus")).toHaveCount(1);
    // The card's links are reachable.
    const reached = new Set<string>();
    for (let i = 0; i < 200 && reached.size < 2; i++) {
      await page.keyboard.press("Tab");
      const label = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
      if (/Živá data na webu Povodí|Odkaz na tuto nádrž/.test(label)) reached.add(label);
    }
    expect([...reached].sort()).toEqual(["Odkaz na tuto nádrž", "Živá data na webu Povodí"]);
  });
});

test.describe("accessibility checks (tasks 8.9)", () => {
  const axe = (page: Page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]);

  test("no violations on the start page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".resbtn").first()).toBeVisible();
    const { violations } = await axe(page).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.length}× ${v.help}`)).toEqual([]);
  });

  test("no violations with a station card open", async ({ page }) => {
    await page.goto("/?stanice=pvl-orlik");
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
    const { violations } = await axe(page).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.length}× ${v.help}`)).toEqual([]);
  });
});

test.describe("layout (site-availability spec)", () => {
  test("nothing overflows the screen width", async ({ page }) => {
    await page.goto("/?stanice=pvl-orlik");
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test("phones show the map above the sheet, which opens on the list", async ({ page }) => {
    test.skip(!isPhone(page), "phone layout only");
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Seznam", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const map = await page.getByRole("region", { name: "Mapa nádrží" }).boundingBox();
    const sheet = await page
      .getByRole("complementary", { name: "Detail a seznam nádrží" })
      .boundingBox();
    expect(map!.y + map!.height).toBeLessThanOrEqual(sheet!.y);
    await page.locator(".resbtn").first().click();
    await expect(page.getByRole("button", { name: "Detail" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("list rows are at least 44 px tall", async ({ page }) => {
    await page.goto("/");
    await openList(page);
    const heights = await page
      .locator(".row")
      .evaluateAll((rows) => rows.map((r) => r.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  });

  test("on localhost a page load only requests the site's own files", async ({ page }) => {
    const foreign: string[] = [];
    page.on("request", (r) => {
      if (!r.url().startsWith("http://localhost:4173") && !r.url().startsWith("data:"))
        foreign.push(r.url());
    });
    await page.goto("/");
    await selectFromList(page, /Slezská Harta/);
    await page.waitForTimeout(1500);
    expect(foreign).toEqual([]);
  });
});

test.describe("visit counting (visit-statistics spec, tasks 8.11)", () => {
  /** Serve the local build as https://stavvody.cz and record requests to the counter. */
  const asProduction = async (page: Page, counter: "ok" | "blocked") => {
    const counted: string[] = [];
    await page.route("https://stavvody.cz/**", async (route) => {
      const url = new URL(route.request().url());
      const response = await route.fetch({
        url: `http://localhost:4173${url.pathname}${url.search}`,
      });
      await route.fulfill({ response });
    });
    await page.route("https://stavvody.goatcounter.com/**", async (route) => {
      counted.push(route.request().url());
      if (counter === "blocked") await route.abort("blockedbyclient");
      else await route.fulfill({ status: 204 });
    });
    return counted;
  };

  test("a page load on stavvody.cz is counted once; selecting stations adds nothing", async ({
    page,
  }) => {
    const counted = await asProduction(page, "ok");
    await page.goto("https://stavvody.cz/?stanice=pvl-orlik");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("VD Orlík");
    await selectFromList(page, /Slezská Harta/);
    await page.clock.runFor(4000);
    await expect.poll(() => counted.length).toBe(1);
    expect(new URL(counted[0]!).searchParams.get("p")).toBe("/?stanice=pvl-orlik");
    const cookies = await page.context().cookies();
    expect(cookies).toEqual([]);
  });

  test("the site works with the counter blocked", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await asProduction(page, "blocked");
    await page.goto("https://stavvody.cz/");
    await page.clock.runFor(4000);
    await selectFromList(page, /Slezská Harta/);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("VD Slezská Harta");
    expect(errors).toEqual([]);
  });
});

test.describe("methodology page (data-transparency spec, tasks 9.3)", () => {
  test("is linked from the footer and covers every required topic", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Jak data vznikají a co znamenají barvy" }).click();
    await expect(page).toHaveURL(/\/metodika\/$/);
    const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
    expect(headings).toEqual([
      "Neoficiální projekt",
      "Odkud data pocházejí",
      "Prostory v nádrži",
      "Jak určujeme stav nádrže",
      "Proč plánované snížení nehodnotíme",
      "Souhrnná čísla",
      "Změna od včerejška",
      "Mapa",
      "Počítání návštěv",
      "Mapové podklady a licence",
    ]);
    await expect(page.getByText("přispěvatelé OpenStreetMap")).toBeVisible();
    await expect(page.getByText(/produced using Copernicus\s+WorldDEM-90/)).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.length}× ${v.help}`)).toEqual([]);
  });
});
