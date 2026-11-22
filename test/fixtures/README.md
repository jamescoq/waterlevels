# Portal page fixtures

Saved copies of the Povodí reservoir portal pages, used by the parser tests. One folder per source code (`pmo`, `pod`, `poh`, `pvl`, `pla`), each with:

| File | Page | Captured |
|---|---|---|
| `overview.html` | `Prehled.aspx` | 2026-11-22 10:39 Prague time |
| `volumes.html` | `Objemy.aspx` | 2026-11-22 10:39 Prague time |
| `detail.html` | `Mereni.aspx` for one station | 2026-11-22 |

Detail pages: Moravy – VD Dalešice (`id=14&oid=2`), Odry – VD Slezská Harta (`id=300021251&oid=1`), Ohře – VD Fláje (`id=2037&oid=2`), Vltavy – VD Bílsko (`id=BIBI&oid=1`), Labe – Bedřichov (`id=100&oid=1`).

The pages and their data belong to the respective Povodí state enterprises and are kept here unchanged, only for testing. The repository's MIT licence does not cover them.

Replace a fixture only when a portal changes its layout, and keep the parser tests passing against the new copy.
