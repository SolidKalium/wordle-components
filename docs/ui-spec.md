# UI Architecture Spec

## Overview

The Wordle engine has three UI contexts:

1. **Prepared interactive page** — a standalone HTML page with pre-arranged analysis and play components sharing state.
2. **AI artifacts** — Claude drops self-contained composite components into chat. No manual wiring.
3. **Library use** — others build custom pages using individual components, composites, or both.

The core Wordle library (game engine, strategies, analysis) has no UI awareness. All reactivity lives in a wrapper layer at the UI boundary.

## Scope

This doc is for aligning Claude and other informed editors on how the UI layer is put together — store roles, component tiers, the prepared page's shape. It isn't end-user API documentation: it doesn't enumerate every field or method a store exposes (read the store source for that), and it isn't a guide for someone consuming this as a library. Consumption-facing docs will likely live in a separate file once that surface stabilizes.

Contexts 2 and 3 above (AI artifacts, library use) are the long-term goal but have no implementation yet — there's no composite layer and no artifact-generation entry point. Everything built so far serves context 1.

---

## Reactive Stores

Stores are zustand stores provided via React context. The core library classes (`Game`, `Strategy`, `ConstraintState`, etc.) stay pure — no events, no subscriptions, no UI imports. Stores are the only place that wraps them for reactivity.

### GameStore

Wraps a `Game` instance and re-derives a snapshot (including a fresh `ConstraintState`) on every move. Owns the single source of truth for an in-progress or completed game: guess history, derived constraints, remaining candidate words, and game status. Used wherever a card is playing or replaying an actual game (`GameBoard`, `WordInput`, `SuggestionPicker`).

### StrategyStore

Wraps strategy selection and simulation. Holds the chosen strategy/filter id and the results of running that strategy across the answer set — delegated to a background worker, with results cached per strategy+filter so repeat selections don't re-simulate. Each card that wants its own independent strategy comparison creates its own `StrategyStore` instance.

### ConstraintStore

Holds the manual constraint editor's raw input (the editable `green`/`yellow`/`unplaced`/`gray` arrays a person types into) plus the derived `ConstraintState` and matching word list. Unlike `GameStore`, there's no underlying `Game` — this is for exploring a constraint set that didn't come from playing a game move-by-move. The raw arrays are private editor-buffer state; nothing outside the editor should read them directly.

`useConstraints()` is the shared read path for anything that just wants the current constraints, regardless of source: it prefers a `ConstraintStore` from context, falling back to the `GameStore`'s constraints if no constraint store is present. `ConstraintsView` and `BruteForceList` both go through it, which is why they work unmodified in either the game cards or the Constraint Explorer card.

### Store Rules

- Stores are the single source of truth. Components read through the store, never cache the underlying object.
- No designated "owner" of a field — any component with access to a store can read or write any field it exposes.
- Prefer the derived `constraints` (a `ConstraintState`) over a store's raw input fields when consuming, not producing, constraint data. Raw fields are editor-internal.

---

## Component Tiers

### Tier 1: Primitive Components

Single-responsibility, each declaring which store(s) it subscribes to. Not exhaustive — illustrative of current shape:

| Component | Reads | Writes | Purpose |
| --- | --- | --- | --- |
| `GameBoard` | game: guesses, isOver, solved, answer | game: newGame | Renders guess history, starts a new game |
| `WordInput` | game: isOver, constraints, answer | game: makeMove | Text entry for the next guess |
| `SuggestionPicker` | game: remainingWords, isOver | game: makeMove | Suggests/plays a next move from remaining words |
| `ConstraintsView` | useConstraints() (constraint store, else game) | — | Renders known/not-at/unplaced/gray letters |
| `ConstraintEditor` | constraint store (raw fields + derived) | constraint store setters | Manual constraint entry UI |
| `BruteForceList` | useConstraints() | — | Lists/paginates words matching current constraints |
| `StrategySelector` | strategy: strategyId, filterId | strategy: setStrategy, setFilter | Strategy/filter choice |
| `DistributionChart` | strategy: simulationSummary, simulationPending, simulationProgress | — | Bar chart of guesses-to-solve distribution |
| `TreeNavigator` | strategy: treeRoot, simulationPending, simulationProgress | — | Navigable decision tree for deterministic strategies |
| `CliTerminal` | (owns its own session, not store-backed) | — | Terminal-style play/inspect interface |

### Tier 2: Composite Components

Not built yet. The intent is pre-wired groups of primitives that can run standalone (own internal stores, for AI artifacts/demos) or shared (externally provided stores, for the prepared page). Today the prepared page wires Tier 1 components directly into `Card`s in `main.jsx` instead — there's no composite abstraction in between. Worth revisiting once enough cards share the same component groupings to justify naming them (candidates from the original draft: a game+constraints+suggestions bundle, a strategy-vs-strategy comparison, a strategy+tree explorer).

### Tier 3: Cards

`Card` is the visual container (title, optional collapse) — implemented and matches this role. Cards do not introspect their contents.

---

## Connection Highlighting

Idea: while a card has focus, give a subtle visual cue to other cards that share a store with it, purely derived from store membership. Not implemented; low priority for now.

---

## Prepared Interactive Page Layout

Current `main.jsx` cards, top to bottom: a strategy-distribution gallery (one chart per strategy, own store each), a Strategy Explorer (selector + chart), a Decision Tree explorer, two Game cards sharing one `GameStore` but rendering constraints differently (history view vs. constraint view), a Constraint Explorer (editor + viewer + brute-force list sharing one `ConstraintStore`), and a Terminal card. Layout is ad hoc rather than following a fixed top/middle/bottom plan — adjust freely as cards are added.

---

## Non-Goals for Initial Implementation

- Generic "build your own" page with drag-and-drop card arrangement
- Config file save/load for strategy and filter combinations
- Tree search / full-depth optimal solver (deferred; heuristic strategies first)
- Claude skill integration (deferred to after UI is functional)
- Multiple word list support or separate guess/answer lists
