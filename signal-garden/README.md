# Signal Garden

Signal Garden is a private, local-first home for unfinished thoughts, promising experiments, and the next small step.

Ideas move from **Seed → Sprout → Bloom** as you water them or complete focused work sessions. The app notices high-impact ideas that have gone quiet and turns the state of the whole garden into a small, deterministic “weather” forecast.

## Features

- Capture ideas with notes, tags, energy, impact, and a next action.
- Filter and sort a responsive garden without sending data anywhere.
- Focus timer with 5, 15, and 25 minute sessions.
- Deterministic “Needs sunlight” resurfacing and garden weather.
- Browser-local persistence, cross-tab refresh, JSON export, and validated import.
- Keyboard-friendly dialogs, reduced-motion support, and responsive layouts.
- Offline app shell through a small service worker.

## Run locally

Serve the `dist` directory with any static server. For example:

```bash
python3 -m http.server 4173 --directory dist
```

Then open `http://localhost:4173`.

No build step or dependencies are required.

## Privacy

Garden data is stored only in the browser's `localStorage`. Export a JSON backup before clearing site data or switching browsers.
