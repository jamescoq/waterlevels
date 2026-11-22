# Tasks

## 1. Setup

- [x] 1.1 Create the pnpm TypeScript project with ESLint, Prettier and Vitest, and the folder layout from design.md Decision 2; verify `pnpm lint`, `pnpm typecheck` and `pnpm test` pass on the empty project
- [x] 1.2 Add `ci.yml` (lint, type check, tests, build on pull requests and pushes to `main`); verify a pull request shows a green run
- [x] 1.3 Export the four canvas artboards into `design/`; verify the desktop, phone list, phone detail and six-states references are present
- [x] 1.4 Create the orphan `data` branch with an empty `snapshots/` folder; verify `git ls-remote` shows the branch

## 2. Portal probe

- [x] 2.1 Add `probe.yml`, guarded to run only in this repository, that fetches robots.txt, `Prehled.aspx` and `Objemy.aspx` for every source and uploads the pages; verify a manual run lists a status code and row count for all five sources
- [x] 2.2 Find the Povodí Labe reservoir portal and add it to the probe; verify the probe loads its overview and volumes pages
- [x] 2.3 Record the URL patterns, robots.txt rules, column layout, station count and the time of day the 07:00 reading appears for each portal in `sources.ts` comments; verify every source has an entry and the cron time in design.md is later than the latest of those times
- [x] 2.4 Povodí Ohře blocks the GitHub-hosted runner with a Cloudflare challenge; mark it paused in `sources.ts` with the reason, per design.md Decision 3; verify `sources.ts` marks only `poh` as paused

## 3. Parsers

- [x] 3.1 Save the overview, volumes and one detail page of every source as fixtures in `test/fixtures/<source>/`; verify 15 fixture files exist
- [x] 3.2 Implement Czech number and Prague time parsing; verify the decimal-comma and summer-time scenarios of `water-data-collection` pass as unit tests
- [x] 3.3 Implement the MGE overview and volumes parsers; verify fixture tests cover every source, blank versus dash cells, and the Dalešice duplicate row
- [x] 3.4 Implement the implausible-value bounds; verify the "Level far above the crest" and "Reservoir emptied for repairs" scenarios pass as unit tests

## 4. Station registry

- [x] 4.1 Write `scripts/registry/` to read portal ids, zone levels and height datum from detail pages into `registry/stations.json`; verify every station has a portal id and explicit values or nulls for all levels
- [ ] 4.2 Add coordinates and river names to every station; verify a test that every station lies inside the Czechia bounding box
- [x] 4.3 Add the zod schemas for stations and overrides; verify the registry files validate in CI
- [x] 4.4 Collect purpose tags where known; verify the field is present on every station, even if empty

## 5. Daily collection

- [x] 5.1 Implement the polite HTTP client (User-Agent, robots.txt, 2 s spacing, 30 s timeout, two retries); verify mocked-server tests for the request budget, robots.txt blocking and retry scenarios
- [x] 5.2 Implement the run: scrape (fetching a page again after 30 s, at most twice, when the portal answers with its "Prosím, čekejte, načítám data" placeholder), match stations, contain source failures, apply validation guards, write the snapshot with every parsed value; verify tests for the layout-change, all-unreachable, one-portal-down, paused-source, unmatched-row and value-not-shown scenarios, including that a paused source receives no request
- [ ] 5.3 Add `scrape.yml` with the schedule, the repository guard, the commit to `data`, `status/last-run.json` and the raw-page artifact with 90-day retention; verify a manual run commits a snapshot and uploads the artifact, and that the guard condition is on the scrape job
- [x] 5.4 Add `pnpm reparse <archive-dir>...` that regenerates snapshots from downloaded raw-page artifacts; verify it reproduces a committed snapshot byte for byte
- [ ] 5.5 Add the dead-man's-switch ping with its URL as a repository secret; verify the check service records a ping after a manual run
- [x] 5.6 Add the `alert` job that runs last and fails for a "partial" source, a source without usable data in three consecutive snapshots, or a new unmatched row; verify with fixture snapshots that it fails in each case, passes after a one-day outage and for a paused source, and that the snapshot commit and deploy still happen

## 6. Derivation

- [ ] 6.1 Implement the status rules in one module with the 70 % and 40 % thresholds as constants; verify every `station-status` scenario passes as a table-driven test
- [ ] 6.2 Implement the change since yesterday with the 18–30 hour window; verify the rose, no-change, first-day and portal-did-not-update scenarios
- [ ] 6.3 Implement circle size and overlap handling; for the desktop and the phone layout; verify the circle-size scenarios, a test that no circle moves more than 16 px in either layout, and the two-neighbours and dense-cluster scenarios
- [ ] 6.4 Generate `latest.json` from registry, overrides and snapshots; verify it validates against its schema and is under 50 KB gzipped for the real station count
- [ ] 6.5 Implement the headline and status counts as a shared function used by the browser; verify every `national-summary` scenario passes as a unit test

## 7. Map assets

- [ ] 7.1 Write `scripts/map/` (Natural Earth border, rivers in three weights, cities, hillshade warped to the project projection) with a README of every command; verify re-running it reproduces the committed outputs
- [ ] 7.2 Check that every tributary meets its main river after simplification; verify by a visual review recorded in the pull request
- [ ] 7.3 Keep map assets within budget; verify geometry under 150 KB gzipped and each hillshade size under 300 KB
- [ ] 7.4 Record source, licence and required credit for every map dataset in `scripts/map/README.md`; verify each dataset has all three

## 8. Front end

- [ ] 8.1 Scaffold Vite + Preact with self-hosted Outfit and Inter and the colour tokens from the design doc; verify the build passes and a page load makes no request outside the site's own origin
- [ ] 8.2 Build the header, hero headline, weighted-fill sentence and status chips; verify against the desktop artboard and the `national-summary` scenarios in a component test
- [ ] 8.3 Build the map: hillshade, border, rivers, cities, circles by status, labels, legend, hover and focus preview, selection; verify against the desktop artboard and the `station-map` scenarios
- [ ] 8.4 Build the list tab grouped by Povodí with hover highlight and selection; verify the `station-list` scenarios
- [ ] 8.5 Build the station card with the dam cut-through, level sentence, note box, share link and source link; verify against the six-states artboard and the `station-detail` scenarios
- [ ] 8.6 Apply the 36-hour rule in the browser and add the stale banner, loading skeleton, source-failed and first-day states and the no-data-yet notice; verify each state with fixture data in a component test
- [ ] 8.7 Implement `?stanice=` selection with `history.replaceState`; verify the shared-link, unknown-id and back-button scenarios in the Playwright smoke test
- [ ] 8.8 Build the phone layout with the bottom sheet opening on the list; verify against the phone artboards at 390 px width with no horizontal scroll
- [ ] 8.9 Meet the `site-accessibility` requirements; verify an automated axe check reports no violations, a keyboard-only walk-through, and contrast of the smallest labels
- [ ] 8.10 Build the footer with sources, update frequency, "data bez záruky" and the unofficial notice; verify the `data-transparency` footer scenarios
- [ ] 8.11 Add visit counting with a self-hosted, pinned `count.js`, loaded only on stavvody.cz with an explicit path; verify in the Playwright test that a load under the production hostname sends exactly one request to the counter, a load on localhost sends none, selecting stations sends none, and the site works with the counter request blocked

## 9. Hosting and launch

- [ ] 9.1 Add `deploy.yml` as a reusable workflow called by `scrape.yml` and triggered by pushes to `main` and `data`; verify a manual scrape run ends with a new Pages deployment
- [ ] 9.2 Set the DNS records, verify the domain in GitHub, set the custom domain and enforce HTTPS; verify `https://stavvody.cz` loads and both http and www redirect to it
- [ ] 9.3 Write the Czech methodology page with the map data credits; verify it covers every topic in the `data-transparency` methodology requirement
- [ ] 9.4 Render the map at the real station count and have the owner choose a density solution if it is crowded; verify the decision is recorded in design.md
- [ ] 9.5 Review the 70 % and 40 % thresholds against a week of real data with the owner; verify the decision is recorded in design.md
- [ ] 9.6 Measure the home page with a mobile lab test; verify Largest Contentful Paint is 2.5 s or less
- [ ] 9.7 Have the owner create the GoatCounter site and put its site code into the build configuration; verify a visit to https://stavvody.cz appears in the GoatCounter dashboard and that the browser stores no cookie
- [ ] 9.8 Add stavvody.cz to Google Search Console using DNS verification; verify the property shows as verified
- [ ] 9.9 Have the owner ask Povodí Ohře to let `stavvody.cz-bot` through Cloudflare or to provide a data feed; once agreed, run the probe workflow and remove the pause; verify the probe loads both Ohře pages from GitHub and the next snapshot records `poh` as "ok"

## 10. Integration checks

- [ ] 10.1 Let the scheduled job run seven consecutive days; verify seven snapshots on `data` and seven successful deployments
- [ ] 10.2 Simulate a failed source and a failed run on a test branch; verify the site shows "Bez dat" for that source's stations and keeps serving the previous data
- [ ] 10.3 Check freshness end to end; verify new measurement times are visible on https://stavvody.cz within 30 minutes of a successful run

## Workflow follow-up

- Archive this change after launch so its specs become the project's baseline in `openspec/specs/`.
