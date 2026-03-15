# Plan: zerojournal-react

> Last updated: 2026-03-15
> Version: 1.0

## Objective

ZeroJournal v2 — a local-first React rewrite of the Streamlit trading journal. Client-side only (no backend), with IndexedDB persistence, Web Worker Excel parsing, and a modern UI (Tailwind + Radix/shadcn). Targets the same Zerodha trader audience with faster performance and richer interactivity.

## Current Phase

implementation

## Scope

### In Scope
- Excel tradebook/P&L parsing via Web Worker (< 200ms for 2,219 trades)
- FIFO matching, analytics engine (Sharpe, drawdown, expectancy, streaks)
- IndexedDB persistence (portfolio, metadata, settings, journal)
- Dashboard with Overview/Analytics/Trades tabs
- Trade journal with CRUD
- Lazy-loaded Recharts with error boundaries
- Playwright e2e + Vitest unit tests (80% coverage threshold)
- Date/symbol filtering

### Out of Scope
- Backend / server-side processing
- Multi-broker support
- Real-time market data
- User accounts / cloud sync
- Mobile native app

## Milestones

| # | Milestone | Target Date | Status |
|---|-----------|-------------|--------|
| 1 | Core engine (FIFO, analytics, timeline) | — | completed |
| 2 | Web Worker parsing | — | completed |
| 3 | Zustand stores + IndexedDB persistence | — | completed |
| 4 | Dashboard pages (Overview, Analytics, Trades) | — | completed |
| 5 | Journal feature (calendar UI + IndexedDB v5) | — | completed |
| 6 | Analysis page + insights | — | in-progress |
| 7 | E2E test coverage + polish | — | not-started |

## Task Breakdown

### Phase 1: Core Engine (complete)
- [x] Order grouper, FIFO matcher, analytics, timeline, cumulative metrics, insights
- [x] Web Worker parsing with fallback
- [x] Zustand stores (portfolio, UI, journal)
- [x] IndexedDB persistence (v5 schema)

### Phase 2: UI (in progress)
- [x] Dashboard with lazy-loaded charts
- [x] Import page
- [x] Journal page (calendar-based redesign with trade bubbles, day detail sheet)
- [ ] Analysis page completion
- [ ] Filter refinements

### Phase 3: Quality
- [ ] E2E test suite (Playwright)
- [ ] Coverage to 80%+ across all thresholds
- [ ] Performance profiling for large datasets

## Open Questions

- Whether to add sector analysis (like Streamlit version) — requires yfinance or equivalent JS library
- Deployment target (static hosting vs. Electron for desktop)

## Dependencies

- Node.js, React 18, Vite 5, TypeScript 5.9
- Test fixtures (XLSX files) need copying to worktrees
