# stavvody.cz

A one-page map of how full Czech reservoirs are today, built from the public reservoir portals of the five Povodí state enterprises. Personal, non-commercial and unofficial. Work in progress.

- What the site does and how it is built: [`openspec/changes/launch-reservoir-map-v1/`](openspec/changes/launch-reservoir-map-v1/) (proposal, specs, design, tasks)
- Visual design reference: [`design/`](design/)

## Development

Requires Node.js 22 and pnpm.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

`pnpm probe` fetches robots.txt, the overview and the volumes page from each of the five portals (15 requests) and writes a report to `probe-out/`. Run it sparingly.

## Deployment

GitHub Actions publishes the site to GitHub Pages:

- `scrape.yml` runs daily at 07:17 UTC, commits the snapshot to the `data` branch and calls `deploy.yml`.
- `deploy.yml` builds `latest.json` from the `data` branch (`pnpm derive`), builds the site and deploys it. It also runs on every push to `main`.

One-time setup in the repository settings: Pages source "GitHub Actions"; optionally the repository variable `GOATCOUNTER_HOST` (e.g. `stavvody.goatcounter.com`) to turn on visit counting, and the secret `HEALTHCHECK_URL` for the daily health-check ping.

## Data

The data belongs to Povodí Moravy, Odry, Ohře, Vltavy and Labe and is published by them without guarantee. This project is not affiliated with them.

Contact: stavvodycz@gmail.com

## Licence

The code is released under the [MIT licence](LICENSE). The licence does not cover the Povodí data or the map data, which keep their own terms.
