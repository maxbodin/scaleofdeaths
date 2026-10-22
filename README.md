# Scale of Deaths

**The true scale of human deaths in wars, epidemics, famines and disasters: one dot for every 1,000 lives.**

Numbers like "75 million" are impossible to picture. Scale of Deaths draws every event as a block of dots at the same scale, stacked vertically.

Scrolling from an event with 3,000 deaths to one with 75,000,000 deaths makes the difference something you physically feel. The project was inspired by [1-pixel-wealth](https://eattherichtextformat.github.io/1-pixel-wealth/).
- **1 dot = 1,000 deaths.** A faded last dot shows the remainder. Rings show the upper estimate. Events with fewer than 1,000 deaths are shown as a number.
- **Sub-events are drawn inside their parent.** For example, Hiroshima appears inside the Second World War block as shaded dots, fewest deaths first, in alternating strong and light shades. Sub-events also get their own entries.
- **Events and deaths per category** are counted in a table under the legend. Every death is counted once: deaths in a sub-event count in the sub-event's category, not again in its parent's.
- **Sort** by death toll or by date, ascending or descending.
- **Filter** by category, country and period, and **search** every text of the events (titles, descriptions, notes, countries, sources). The list is filtered as you type and matching words are highlighted; suggestions let you jump straight to an event. Any filter state can be shared through the URL.
- **Random event:** a button jumps to a random event among those the filters show.
- **Orientation aids:** a sticky event title, a label every 10 million deaths in the margin, and a proportional mini-map.
- **English and French.** Every figure has a range and sources.
- **Works without JavaScript** (read-only). Each page is a single self-contained file: every description, note and source is inlined, so the page needs no further request.

## Quick start

Requires [Bun](https://bun.sh) ≥ 1.3. Bun installs the dependencies and runs the TypeScript scripts directly. Node.js ≥ 22 must also be installed, because Playwright runs on Node.

```bash
bun install
bun run dev        # http://localhost:5173 (EN) and /fr/ (FR); reloads when data changes
bun run build      # validated, self-contained pages in dist/
bun run preview    # serve dist/ on http://localhost:4173
```

## Scripts

| Command                           | What it does                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `bun run dev`                     | Dev server. Pages are rendered live from `data/`.                                                        |
| `bun run build`                   | Validates the data, then writes `dist/index.html` and `dist/fr/index.html`, with CSS and JS inlined.     |
| `bun run validate`                | Validates `data/` only. Every error is listed as `file:field - reason`.                                  |
| `bun run test`                    | Unit tests (Vitest). Use `bun run test`, not `bun test`, which is Bun's own test runner.                 |
| `bun run test:e2e`                | End-to-end tests (Playwright) in Chromium, WebKit and Firefox. Run `bunx playwright install` once first. |
| `bun run check:size`              | Brotli size budgets, for the real build and a synthetic 200-event build.                                 |
| `bun run check:lighthouse`        | Lighthouse mobile audit of `dist/` (needs a local Chrome).                                               |
| `bun run check:links`             | Checks that every source URL is reachable (needs network access).                                        |
| `bun run make:og`                 | Regenerates `public/og.png`, the link-preview image (needs Playwright's Chromium).                       |
| `bun run lint` / `bun run format` | Biome (linter and formatter).                                                                            |
| `bun run check`                   | The full pipeline: validate → lint → typecheck → unit → build → size → e2e → Lighthouse.                 |

**Build environment variables** (all optional):
- `SITE_URL` (e.g. `https://example.org`) turns on the canonical link, `hreflang` alternates and an absolute `og:image`.
- `CF_ANALYTICS_TOKEN` adds the cookieless Cloudflare Web Analytics beacon and extends the CSP to allow it.
- `SOD_DATA_ROOT` and `SOD_OUT_DIR` build a different dataset or write to a different output folder.

## How it works

- **No framework and no runtime dependencies.**
  - At build time, the data is validated with `zod`. The pages are then rendered to HTML with plain template functions.
  - The client script (about 4 KB compressed) only adds sorting, filtering, search, the random event button and the mini-map.
- **The dots are pure CSS.**
  - Each run of dots is a single element. CSS `round()`/`mod()` compute its position from the number of columns, and a repeating radial-gradient tile draws the dots. A `clip-path` carves the partial first and last rows.
  - Milestone labels (every 10 million deaths, uncertainty rings included) are positioned the same way.
  - The browser scrolls the dots natively, so nothing is redrawn while scrolling. Resizing is handled by CSS.
- **One request.** CSS and JS are inlined. A strict Content-Security-Policy allows only the hashes of the inline scripts.

```
data/            categories.yaml + one YAML file per event (the dataset)
src/shared/      pure logic shared by the build and the browser (layout, sort, filters, URL state, formatting)
src/build/       data loading and validation, page rendering, the production build
src/client/      browser enhancements (controls, mini-map, scroll position on resize)
src/styles/      the stylesheet (inlined at build time)
src/i18n/        UI strings (en, fr)
scripts/         CLI entry points
tests/           unit (Vitest), e2e (Playwright), fixtures
```

## Browser support

The last two versions of Chrome, Edge, Firefox and Safari, plus iOS Safari 16.4+ and Chrome Android. The minimum viewport width is 320 px.

## Contributing

Adding or correcting an event takes a single YAML file. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [data policy](DATA_POLICY.md).

## Licence

- Code: [PolyForm Noncommercial 1.0.0](LICENSE). You may use, copy, modify and share it for any non-commercial purpose; selling it or using it commercially is not permitted.
- Data and texts in `data/`: [CC BY 4.0](LICENSE-DATA).
