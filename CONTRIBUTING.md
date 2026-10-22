# Contributing

Thank you for helping make these figures accurate and complete. Most contributions are **data**: you add or correct one event in one file. Please read the [data policy](DATA_POLICY.md) first.

## Add an event

1. Copy an existing file from `data/events/` to `data/events/<id>.yaml`, where `<id>` is a kebab-case English slug.
2. Fill in the English **and** French title and description, the figures, the countries and every source. Set `reviewed: false`.
3. Run `bun run validate`, then `bun run dev` to see the event in place.

## Event file reference

`data/events/<id>.yaml`. The file name must equal `id`.

| Field                        | Required              | Notes                                                                                                                                                                                                                |
| ---------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                         | yes                   | kebab-case English slug, unique                                                                                                                                                                                      |
| `title`                      | yes                   | `{ en, fr }`.                                                                                                                                                                                                        |
| `description`                | yes                   | `{ en, fr }`, ≤ 600 characters each. Neutral and factual.                                                                                                                                                            |
| `categories`                 | yes                   | One or more of `war`, `epidemic`, `natural-disaster`, `famine`, `genocide`, `accident`, `annual`. **The first one sets the dot colour.**                                                                             |
| `kind`                       | no                    | `event` (default) or `endemic-total` (cumulative deaths from an ongoing cause over a stated period)                                                                                                                  |
| `start` / `end`              | `start` yes           | `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. Negative years are BCE: `"-0430"` = 430 BCE. Quote dates in YAML.                                                                                                                 |
| `circa`                      | no                    | `true` displays "c. 541"                                                                                                                                                                                             |
| `ongoing` / `asOf`           | no                    | Use `ongoing: true` with `asOf: YYYY-MM-DD` (the date of the latest figure). Omit `end`.                                                                                                                             |
| `deaths.best`                | yes                   | The figure drawn as solid dots (an integer). See the policy for how to choose it.                                                                                                                                    |
| `deaths.low` / `deaths.high` | when sources disagree | `low ≤ best ≤ high`. `high - best` is drawn as rings.                                                                                                                                                                |
| `deaths.note`                | no                    | `{ en, fr }`: what the figure includes or excludes                                                                                                                                                                   |
| `countries`                  | yes                   | List of `{ code, name?, deaths? }`. `code` is an ISO 3166-1 alpha-2 country code (`GB`, not `UK`; no `EU` or `UN`). Former states (`SU`, `YU`, …) need a `name`. Historical entities without a code use `name` only. |
| `partOf`                     | no                    | Parent event id. The event is drawn inside the parent's grid **and** listed on its own. Only one level of nesting is allowed.                                                                                        |
| `related`                    | no                    | Ids of concurrent, non-nested events. Links are shown both ways.                                                                                                                                                     |
| `sources`                    | yes                   | At least one `{ title, url (https), publisher?, accessed: YYYY-MM-DD }`                                                                                                                                              |
| `reviewed` / `lastReviewed`  | `reviewed` yes        | Never set `reviewed: true` yourself.                                                                                                                                                                                 |

Text fields must not contain em dashes: use a hyphen. The build rejects any file that breaks these rules and lists **every** problem at once. For example:

```
data/events/foo.yaml:deaths.low - must be ≤ best
data/events/bar.yaml:partOf - unknown event "baz"
```

## Annual causes of death

Events in the `annual` category give the deaths of one year from a recurring cause (road traffic, malaria, shark attacks...). Put `annual` first in `categories`, use `kind: endemic-total` with `start` and `end` set to the same year, and end both titles with **"per year"** / **"par an"**, for example "Deaths from shark attacks per year".

## Sub-events

- A sub-event must be a **subset** of its parent: the Holocaust is part of the Second World War, and so is the bombing of Hiroshima.
- Sub-events of the same parent must not overlap one another. The sum of their `best` values cannot exceed the parent's.
- Events that are only concurrent are not sub-events. The 1918 influenza pandemic, for example, happened alongside the First World War; link such events with `related` instead.

## Translations

UI strings live in `src/i18n/en.ts` and `src/i18n/fr.ts`. TypeScript refuses to compile if a French key is missing. The build reports how many event fields fell back to English.

## Code contributions

- `bun run check` must pass. It runs validation, lint, typecheck, unit tests, the build, size budgets, e2e tests in three browsers and Lighthouse.
- **Code limits:**
  - files ≤ 300 lines
  - functions ≤ 50 lines
  - ≤ 4 parameters
  - nesting ≤ 3
- **No runtime dependencies.** Pure logic goes in `src/shared/`, with no DOM access, so it can be unit-tested.
- **Performance budgets:**
  - ≤ 300 KB brotli per real page (all texts and sources are inlined), ≤ 100 KB for the synthetic 200-event page
  - ≤ 10 KB JS
  - ≤ 6 KB CSS
  - Lighthouse performance ≥ 90, LCP ≤ 3 s, CLS 0, TBT ≤ 50 ms
  - zero third-party requests
- The page must stay readable without JavaScript.
