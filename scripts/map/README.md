# Map assets

Builds the map's static layers in the same projection and frame as the station circles (`src/shared/projection.ts`; design.md Decision 5).

```bash
pnpm map:build     # writes public/map/geometry.json, hillshade-880.webp, hillshade-1760.webp
pnpm map:preview   # writes .cache/map-preview.png: everything composed, for a visual check
```

Run by hand on a developer machine; the outputs are committed. Downloads are cached in `.cache/map-sources/`, so a rerun sends no requests and reproduces the committed files. Delete that folder to fetch fresh data.

## Sources, licences and credits

| Layer                     | Source                                                                                                                                                        | Licence                                                | Credit required                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Country border, city dots | [Natural Earth](https://www.naturalearthdata.com/) 1:10m, release v5.1.2 (`ne_10m_admin_0_countries`, `ne_10m_populated_places_simple`)                       | Public domain                                          | No (“Made with Natural Earth” appreciated)                                                                                                               |
| Rivers and streams        | [OpenStreetMap](https://www.openstreetmap.org/) via the Overpass API (`waterway=river` in Czechia, plus streams named in the station registry)                | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) | Yes: “© přispěvatelé OpenStreetMap” with a link to https://www.openstreetmap.org/copyright                                                               |
| Relief (hillshade)        | [Copernicus DEM GLO-90](https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model), read from the public AWS bucket `copernicus-dem-90m` | Copernicus DEM licence (GLO-90 free for everyone)      | Yes: “Copernicus DEM GLO-90 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the European Union and ESA” |

Before launch (tasks 9.3), check the Copernicus credit wording against the current licence text and put all credits on the methodology page.

## How the layers are made

- **Border:** Czechia's polygon from Natural Earth, projected and simplified to 0.35 px.
- **Rivers:** OpenStreetMap ways grouped into rivers (same name, connected). Main rivers are 150 km or longer, tributaries 40–150 km, feeder streams are the stream at each placed reservoir. Every chosen river is followed downstream to the river it flows into, which is kept too, so every tributary meets its main river. Clipped to the border and simplified to 0.35 px.
- **Cities:** the twelve Czech cities in Natural Earth, with Czech names.
- **Hillshade:** elevation sampled at every pixel of the projected frame, shaded with Horn's method (sun from the north-west at 45°, relief exaggerated 2×, muted in lowlands), tinted in the design's blues and made transparent outside the border. Two widths: 880 px and 1760 px for high-DPI screens.

## Budgets (design.md, Performance budget)

| File            | Budget               |
| --------------- | -------------------- |
| `geometry.json` | under 150 KB gzipped |
| each hillshade  | under 300 KB         |

`test/map-assets.test.ts` checks both, and that the committed files match the projection's frame.
