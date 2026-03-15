<!-- CC-PROJECT-FRAMEWORK-INTEGRATED -->

## 🔴 MANDATORY: Read Before Any Work

Before starting ANY task, you MUST:

1. Read `docs/PLAN.md` — the current strategic plan and scope
2. Read `docs/STATUS.md` — what's done, in progress, and blocked
3. Read `docs/DECISIONS.md` — why things changed (if it exists)
4. Read any spec files in `docs/specs/` — SDD artifacts live here

If any of these files don't exist, create them.

## 🔵 Status Reporting (AUTOMATIC — DO THIS ALWAYS)

After completing any meaningful unit of work (feature, fix, task, subtask), you MUST
update `docs/STATUS.md` by appending an entry in this format:

```
### [YYYY-MM-DD HH:MM] — {{summary}}
- **Type**: feature | fix | refactor | research | planning
- **Status**: completed | in-progress | blocked
- **Files changed**: list of key files
- **What was done**: 1-2 sentence description
- **What's next**: 1-2 sentence description of immediate next step
- **Blockers**: none | description of what's blocking
```

This is NON-NEGOTIABLE. The project dashboard depends on this file being current.

## 🟡 Plan Hierarchy (IMPORTANT)

```
docs/PLAN.md              ← STRATEGIC (master, human-updated)
  │                          Project direction, scope, phases, milestones.
  │
  └── .omc/plans/*        ← TACTICAL (per-feature, OMC-created)
                             Implementation plans for specific features/tasks.
```

Rules:
- ALWAYS read `docs/PLAN.md` first to understand project direction
- NEVER contradict `docs/PLAN.md` in an OMC tactical plan — if conflict, PLAN.md wins
- If the user gives a strategic change (scope, pivot, dropped feature), update `docs/PLAN.md`
- `docs/PLAN.md` feeds the cross-project dashboard. `.omc/plans/` do not.

## 🟠 Plan Change Protocol

When new information arrives that changes the plan:

1. Update `docs/PLAN.md` with the new plan
2. Add an entry to `docs/DECISIONS.md` explaining what/why/impact
3. Update `docs/STATUS.md` to reflect any tasks now invalid/blocked
4. If tasks are in progress that conflict with the new plan, STOP and flag in STATUS.md

<!-- END CC-PROJECT-FRAMEWORK -->
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ZeroJournal v2 — a client-side trading journal for Zerodha users. Parses Excel tradebook/P&L files, computes analytics (Sharpe, drawdown, expectancy, FIFO matching), and displays interactive dashboards. All data stays local (IndexedDB). No backend.

## Commands

```bash
npm run dev          # Vite dev server (HMR)
npm run build        # tsc --noEmit && vite build
npm run typecheck    # tsc --noEmit only
npm test             # vitest run (all tests)
npx vitest run src/__tests__/engine/analytics.test.ts  # single test file
npm run test:watch   # vitest watch mode
npm run test:e2e     # playwright e2e tests
```

## Tech Stack

- React 18 + TypeScript 5.9 (strict) + Vite 5
- Zustand 5 (state) + IndexedDB via `idb` (persistence)
- Tailwind CSS 4.2 + Radix UI + shadcn/ui primitives
- Recharts 3 (charts) + TanStack Table 8 (data tables)
- Vitest + Testing Library (unit) + Playwright (e2e)
- Import alias: `@/` → `./src/`

## Architecture

### Data Flow

```
Excel files → Parser (Web Worker) → portfolio-store.importData() → IndexedDB
                                          ↓
                              groupOrders() → computeAnalytics() → buildTimeline()
                                          ↓
                              Zustand store hydrates → Pages render
```

### Key Directories

- `src/lib/engine/` — Pure computation functions (analytics, FIFO matcher, timeline, insights, cumulative metrics). **No side effects.** Test these with unit tests.
- `src/lib/parser/` — Excel parsing with Web Worker support. Normalizes Zerodha format to `RawTrade[]`.
- `src/lib/store/` — Three Zustand stores: `portfolio-store` (trades, analytics, persistence), `ui-store` (filters, sidebar state, session-scoped), and `journal-store` (journal entries, CRUD via IndexedDB).
- `src/lib/persistence/` — IndexedDB wrapper (DB version 5, four object stores: portfolio, metadata, settings, journal).
- `src/lib/types/index.ts` — All shared TypeScript interfaces. Core types: `RawTrade`, `OrderGroup`, `SymbolPnL`, `TradeAnalytics`, `FIFOMatch`, `TimelinePoint`, `JournalEntry`.
- `src/components/dashboard/` — Lazy-loaded chart components wrapped in `Suspense` + `ChartErrorBoundary`.
- `src/components/ui/` — shadcn/ui primitives (do not modify manually — generated).
- `src/pages/` — Route pages: Dashboard (tabs: Overview/Analytics/Trades), Trades, Analysis, Import, Journal.

### Engine Pipeline

1. **order-grouper.ts** — Groups raw trades by orderId into `OrderGroup[]`
2. **fifo-matcher.ts** — FIFO matches buys/sells per symbol → `FIFOMatch[]` with holding period
3. **analytics.ts** — Computes `TradeAnalytics`: Sharpe ratio, max drawdown, expectancy, streaks, monthly breakdown, trading styles
4. **timeline.ts** — Builds `TimelinePoint[]` for P&L charts with charge distribution by turnover
5. **cumulative-metrics.ts** — Progressive win rate, profit factor, risk-reward, expectancy per trade
6. **insights.ts** — Generates critical/warning/positive/info insights from analytics

### Dashboard Pattern

All dashboard charts follow this pattern:
```tsx
const MyChart = lazy(() => import('@/components/dashboard/MyChart').then(m => ({ default: m.MyChart })))

// In JSX:
<ChartErrorBoundary chartName="My Chart">
  <Suspense fallback={<ChartSkeleton height={300} />}>
    <MyChart data={...} />
  </Suspense>
</ChartErrorBoundary>
```

## Conventions

- Engine functions are pure — take data in, return results. No store access inside engine files.
- Components that need store data use `usePortfolioStore` hooks directly (props for structural data, store for config/derived state).
- Breakeven trades (`pnl === 0`) are excluded from win/loss tallies across the codebase.
- P&L is attributed to position close date (sell date), not buy date.
- Charges are distributed proportionally by turnover, not evenly across dates.
- Indian financial formatting: Rs. prefix, en-IN locale, Lakh (L) suffix for ≥1,00,000.
- All metric calculations are documented in `METRICS.md`.

## Testing

- Tests live in `src/__tests__/` mirroring the source structure (engine/, parser/, persistence/, components/, dashboard/).
- Coverage thresholds: 80% lines/functions/branches/statements.
- Parser tests require fixture XLSX files in `src/__tests__/fixtures/` — these may need copying from the main repo when working in worktrees.
- Vitest excludes `.claude/**` directories.

## Workflow Rules

1. **Test-first for bug fixes**: When asked to fix an issue, first write tests that reproduce the issue, then fix the code until all tests pass.
2. **Always use worktrees inside the project**: Start all work in a new git worktree under `.claude/worktrees/` within the project directory. Never create worktrees outside the project root. Commit only to the worktree branch — do not merge to master without explicit user approval.
3. **Never push without approval**: Do not `git push` to any remote branch without explicit user approval for that specific push. Prior push approvals do not carry forward to new pushes.

```bash
git worktree add .claude/worktrees/<name> -b feature/<branch-name> master
```

## Vite HMR Gotcha

When changes aren't reflected in the browser, kill the server, clear `node_modules/.vite`, restart, and hard refresh (Ctrl+Shift+R).
