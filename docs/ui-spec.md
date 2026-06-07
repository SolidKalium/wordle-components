# UI Architecture Spec

## Overview

The Wordle engine has three UI contexts:

1. **Prepared interactive page** — a standalone HTML page with pre-arranged analysis and play components sharing state.
2. **AI artifacts** — Claude drops self-contained composite components into chat. No manual wiring.
3. **Library use** — others build custom pages using individual components, composites, or both.

The core Wordle library (game engine, strategies, analysis) has no UI awareness. All reactivity lives in a wrapper layer at the UI boundary.

---

## Reactive Stores (Channels)

There are two named stores. Components subscribe to whichever stores they need (zero, one, or both).

### GameStore

Wraps a `Game` instance. Proxies its fields and methods. The `Game` inside is private — components never hold a direct reference to the underlying `Game` object.

**Exposed state (read):**
- `guesses` — array of `{ word, pattern }` (the move history)
- `constraints` — the accumulated `ConstraintState`
- `isOver`, `solved`, `remaining` — derived game status
- `hardMode` — current hard mode setting
- `wordList` — the active word list
- `answer` — the answer (if in known mode, and if the game is over or the component has reveal permission)

**Mutations (write, each notifies relevant subscribers):**
- `makeMove(word, pattern?)` — delegates to `Game.makeMove`, notifies `guesses` and `constraints` subscribers
- `undo()` — restores a snapshot, notifies `guesses` and `constraints` subscribers. Requires snapshot support in `Game` (store `ConstraintState.clone()` before each move, truncate guess history on undo).
- `replace(newGame)` — swaps the underlying `Game` instance, notifies all subscribers (everything potentially changed)
- `setHardMode(bool)` — notifies `hardMode` subscribers

**Subscription model:**
- Components subscribe by field name or field group
- Only subscribers to changed fields re-render
- In React, this maps to `useSyncExternalStore` with a selector, or a zustand-style store with slices
- The store does not use a custom event system; it leverages React's existing selective subscription patterns

### StrategyStore

Wraps the current strategy configuration.

**Exposed state (read):**
- `strategy` — the active `Strategy` instance
- `strategyName` — display name
- `filters` — array of active `Filter` instances
- `config` — strategy-specific parameters (if any)

**Mutations (write):**
- `setStrategy(name, config?)` — instantiate a new strategy, notifies `strategy` subscribers
- `addFilter(filter)` / `removeFilter(index)` — modify filter list, notifies `filters` subscribers
- `setConfig(params)` — update parameters, notifies `config` subscribers

### Store Rules

- Stores are the single source of truth. Components always read through the store, never cache the underlying object.
- Any component can read or write any field on a store it subscribes to. There is no designated "owner" of a field. If two components both allow toggling hard mode, they both write `gameStore.setHardMode()` and both react to the change.
- `replace()` exists on both stores for full-object swaps (new game, different strategy). All subscribers are notified.
- The core library classes (`Game`, `Strategy`, `ConstraintState`, etc.) remain pure — no events, no subscriptions, no UI imports. The stores only exist in the UI import graph.

---

## Component Tiers

### Tier 1: Primitive Components

Single-responsibility. Declare which stores they subscribe to. Examples:

| Component | Reads | Writes | Purpose |
| --- | --- | --- | --- |
| `GameBoard` | game: guesses | game: makeMove | Renders the guess grid, accepts input |
| `ConstraintDisplay` | game: constraints | — | Shows known/excluded/eliminated letters |
| `RemainingWords` | game: constraints, wordList | — | Lists or counts words matching constraints |
| `MoveScorer` | game: constraints, wordList; strategy: strategy, filters | — | Shows top-k moves with scores |
| `PartitionPreview` | game: constraints, wordList | — | Shows partition groups for a candidate guess |
| `DistributionChart` | (accepts results data as prop) | — | Bar chart of guesses-to-solve distribution |
| `DecisionTreeView` | strategy: strategy; game: wordList | — | Navigable tree for deterministic strategies |
| `StrategySelector` | strategy: strategyName | strategy: setStrategy | Dropdown or radio for strategy choice |
| `FilterControls` | strategy: filters | strategy: addFilter, removeFilter | Toggle/configure filters |
| `HardModeToggle` | game: hardMode | game: setHardMode | Single toggle |

This list is not exhaustive. Components are added as needed. These might not all be built as described.

### Tier 2: Composite Components

Pre-wired groups of primitives. Operate in two modes:

- **Standalone mode:** composite creates its own internal stores. Used for AI artifacts and isolated demos.
- **Shared mode:** composite accepts externally provided stores. Used on the prepared page where multiple composites share state.

Mode selection: if stores are passed as props, use them (shared). Otherwise, create internal ones (standalone).

**Composites:**

**`GameExplorer`**
Contains: `GameBoard` + `ConstraintDisplay` + `RemainingWords`
Stores: game
Use: play a game or enter an existing game state, see constraints and remaining words update live.

**`StrategyCompare`**
Contains: two `MoveScorer` instances + `DistributionChart` for each
Stores: game (shared), two independent strategy stores (internal)
Use: compare two strategies side by side on the same game state.

**`DecisionTreeExplorer`**
Contains: `StrategySelector` + `DecisionTreeView`
Stores: game, strategy
Use: pick a strategy and navigate its decision tree.

**`MoveAnalyzer`**
Contains: `MoveScorer` + `PartitionPreview`
Stores: game, strategy
Use: see top moves and drill into what a specific guess would do.

Additional composites are defined as needed. The AI is given a catalog of available composites and uses them by name with optional initial configuration.

### Tier 3: Cards

A card is a visual container. It wraps one component or composite and adds:

- A header/title
- Optional collapse toggle
- Connection highlighting (see below)

Cards do not introspect their contents beyond reading which stores the inner component subscribes to.

---

## Connection Highlighting

When a user is interacting with a card (has focus):

1. Determine which stores that card's component subscribes to.
2. Find all other cards whose components subscribe to any of the same stores.
3. Apply a subtle visual indicator (border color change, faint glow, etc.) to those cards.

This is purely derived from store membership. No explicit wiring or configuration needed. Implementation is deferred until the basic component system works.

---

## Prepared Interactive Page Layout

The prepared page creates stores at the top level and passes them to composites in shared mode. Suggested initial layout (adjustable):

- **Top row:** `GameExplorer` (play or input a game state)
- **Middle row:** `MoveAnalyzer` (top moves + partition drill-down) alongside `DecisionTreeExplorer`
- **Bottom row:** `StrategyCompare` (side-by-side distributions) or a full simulation results panel

Strategy and filter controls live in a sidebar, settings panel, or inline within composites depending on screen layout. Some settings may appear as a gear icon with a popover; the selected strategy name should always be visible.

---

## Non-Goals for Initial Implementation

- Generic "build your own" page with drag-and-drop card arrangement
- Config file save/load for strategy and filter combinations
- Tree search / full-depth optimal solver (deferred; heuristic strategies first)
- Claude skill integration (deferred to after UI is functional)
- Multiple word list support or separate guess/answer lists
