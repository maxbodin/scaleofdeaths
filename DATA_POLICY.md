# Data policy

Scale of Deaths is about human lives. Every figure must be traceable, honest about uncertainty, and neutral in its wording. These rules apply to every event in `data/`.

## What can be listed

- **Any event that caused human deaths can be listed:** wars and armed conflicts, epidemics and pandemics, natural disasters, famines, genocides and political violence (including terrorism), accidents and technological disasters.
- **No minimum toll.** Events with fewer than 1,000 deaths are shown as a number instead of dots.
- **Ancient events (BCE)** are allowed when reputable estimates exist.
- **Ongoing events** are allowed, with `ongoing: true` and an `asOf` date. They must be revisited when new figures are published.
- **Endemic totals** (cumulative deaths from an ongoing cause, such as smallpox in the 20th century) use `kind: endemic-total`. They **must** state the period the estimate covers as `start`/`end`. "Since the dawn of humanity" figures are not accepted without a dated source.

## Choosing the figures

- `best` is the median of the cited reputable estimates. Alternatively, it can be the figure from the most authoritative source. Either way, explain the choice in `deaths.note` when it is not obvious.
- `low` and `high` are **mandatory whenever the sources disagree**. They should cover the range found in reputable sources, not outliers.
- State in `deaths.note` what is included: military and/or civilian deaths, direct and/or indirect deaths, missing people presumed dead, the period covered.
- Per-country counts are optional and only allowed when a source provides them.

## Sources

- Every event needs at least one source. The URL must use `https://`, and the `accessed` date is required.
- **Preferred sources:**
  - academic publications
  - international organisations (WHO, UN agencies)
  - national statistics offices
  - established encyclopaedias
  - Wikipedia articles **together with** the references they cite
- Run `bun run check:links` before submitting.

## Wording

- Titles are factual and use the most widely recognised name (e.g. "Rwandan genocide", "Great Chinese Famine").
- Descriptions are neutral. Responsibility is attributed only as stated by the cited sources.
- Contested ongoing conflicts are included under the same rules: source-attributed ranges, a neutral title and a mandatory `asOf` date.

## Nesting

- `partOf` is only for events that are fully part of a larger one. Sub-events of the same parent must not overlap.
- Concurrent but distinct events use `related`.

## Review

- New and edited events start with `reviewed: false`, which shows a "Draft figures" badge.
