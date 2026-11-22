# Design reference

Source files of the four screens on the design canvas "Czech reservoir map – design mockup", copied on 2026-11-22 from https://claude.ai/artifact/4cmWYMd3wusJXFCg59YuCU.

| File | Canvas screen | Size |
|---|---|---|
| `desktop.dc.html` | Desktop – mapa nádrží | 1440 × 1120, fluid |
| `phone-list.dc.html` | Mobil – seznam (výchozí) | 390 × 844 |
| `phone-detail.dc.html` | Mobil – detail po klepnutí | 390 × 844 |
| `card-states.dc.html` | Karta nádrže – šest stavů | 2240 × 840 |
| `canvas.json` | Canvas index: screen names, sizes, order | – |

These are the canvas's own source files, not standalone pages. They load the canvas runtime (`./support.js`), which is not in this repository, so opening them in a browser does not render the design. Use them for exact layout, colours, spacing and copy; open the canvas link to see them rendered.

All numbers in them are sample data.

The canvas is the visual reference. Product behaviour is specified in `openspec/`, which wins where the two differ, for example the "Jen hladina" status and the `?stanice=` link, which the canvas predates.
