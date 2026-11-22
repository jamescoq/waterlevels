# Proposal: launch the reservoir map v1 at stavvody.cz

Status: proposed. The owner has confirmed the approach: GitHub Pages from a public repository, and Preact for the front end.

## Why

The five Povodí state enterprises publish reservoir data as tables on five separate portals. No site shows all reservoirs on one map with a national summary, and existing lists do not explain planned drawdowns or missing data. stavvody.cz fills that gap for the curious public and for recreation users checking one reservoir (design doc, Intent).

## What Changes

- A public, Czech-only website at https://stavvody.cz with a map of every reservoir the five Povodí portals list, a national headline, a list grouped by Povodí and a card per reservoir with a schematic dam cut-through.
- A daily, polite data collection from the portals that keeps one snapshot per day from day one. v1 uses past snapshots only for the change since yesterday.
- Status rules that describe how full each storage zone is, with planned drawdowns and missing data shown outside the rating instead of as drought.
- Source, measurement time and a "data bez záruky" note shown with every number; a methodology page; a clear statement that the site is unofficial.
- Hosting on GitHub Pages and a scheduled job on GitHub Actions. No server and no database.

Out of scope for this change: history charts, river gauges (planned for v2), forecasts or alerts, an English version, accounts, street-level zoom, ponds the portals do not list.

## Capabilities

### New Capabilities

- `water-data-collection`: daily polite collection from the Povodí portals, validation, and retention of daily snapshots and raw pages.
- `station-status`: the single status of each station, its change since yesterday, and when data counts as missing.
- `national-summary`: the headline numbers for the whole country and the per-status counts.
- `station-map`: the map of Czechia with one circle per station, previews and selection.
- `station-list`: the list of all stations grouped by Povodí and its link to the map.
- `station-detail`: the card of a selected station, the dam cut-through, the share link and the link to the source.
- `data-transparency`: source, measurement time, disclaimer, methodology page and the unofficial notice.
- `site-availability`: where the site is served, its independence from the portals, and its behaviour while loading and when data collection fails.
- `site-accessibility`: accessibility rules that apply across the whole site.

### Modified Capabilities

None. This is the first change in the project.

## Impact

- New code: scraper, derive step, front end, map asset pipeline and GitHub Actions workflows (see design.md).
- New branch `data` holding daily snapshots, written only by the scheduled job.
- External systems: DNS for stavvody.cz, GitHub Pages and Actions on a public repository, about ten requests a day to the Povodí portals.
- Dependencies: Node.js 22, TypeScript, Vite, Preact, cheerio, zod, proj4 (build time only).
- Legal: consent from the five Povodí is still pending. The project stays non-commercial until it is settled (design.md, Risks).
