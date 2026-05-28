# CLI Interaction Spec

Describes the raw-mode input behaviour for the Node CLI (`NodeTerminal`).
Line-buffered fallback (readline) is used when `process.stdin.isTTY` is false
(pipes, CI, test doubles).

---

## Modes and applicability

| Mode       | Suggestions | Explain | Raw input |
|------------|-------------|---------|-----------|
| Basic      | no          | opt-in  | yes       |
| Quickplay  | yes         | (later) | yes       |

Raw mode applies to the guess-input step in both modes.  The user-guess-grading
mode ("computer guesses, human grades") is a separate feature; this doc covers
only the "computer picks a word, player guesses" flow.

---

## Screen layout per turn

``` text
Guess N/6:  _  _  _  _  _     A B C    ← prompt + tile row + pool hint (one line, rewritten in-place)
  1.word  2.word …                      ← suggestions (quickplay only, printed after grading)
  N words remain.                       ← explanation (basic+explain only, printed after grading)
```

The prompt, tile row, and pool hint share a single line.  Every re-render uses
`\r` to return to the start of that line and rewrites all three together, followed
by `ESC[K` to erase any leftover content from a longer previous render.  On
submission `\n` advances past the finalised line before suggestions/explanation
are appended.

The cursor position (0–4) is highlighted with an underline on the tile glyph.
The blinking terminal cursor is hidden for the duration of raw input
(`ESC[?25l` on entry, `ESC[?25h` on exit).

Empty positions render as `   ` (three spaces, no background).

---

## Per-letter styling during input

`_computePending` runs three passes over the buffer to assign a semantic `kind`
to each slot.  Rendering (ANSI or HTML) is separate from this computation.

**Pass 1 — position-level priority (first match wins per slot):**

| Priority | Condition | Kind |
| -------- | --------- | ---- |
| 1 | `known[i] === letter` | `green` |
| 2 | `isExhausted(letter)` | `grey` |
| 3 | `excluded[i].has(letter)` | `yellow-tile` |
| 4 | otherwise | `candidate` |

`isExhausted(letter)` is true when `maxCounts[letter] ≤` number of copies
already in `known[]` (i.e., every copy of the letter is accounted for by
confirmed positions — includes letters eliminated entirely and letters whose
known copies fill their quota).

**Pass 2 — yellow-fg pool assignment (candidates only):**

Pool for letter L = `max(0, minCounts[L] − knownCount[L])`, where `knownCount`
counts occurrences of L in `constraints.known`.  Candidates for L consume the
pool left-to-right; if the pool is not yet exhausted the slot becomes
`yellow-fg`, otherwise `default`.

**Pass 3 — yellow-tile promotion to grey:**

A `yellow-tile` slot becomes `grey` when the pool for that letter has been
fully consumed by `yellow-fg` placements in Pass 2, or when the pool is zero
because `_normalize()` auto-promoted the letter to a `known` position.

**ANSI rendering per kind:**

| Kind | Appearance |
| ---- | ---------- |
| `green` | Green background, bold white text |
| `yellow-tile` | Yellow background, bold black text |
| `grey` | Dark-grey background, bold white text |
| `yellow-fg` | Yellow foreground, default background |
| `default` | Default foreground and background |
| `empty` | Three spaces (no colour) |

The cursor position additionally prepends `ESC[4m` (underline) to the tile, and
renders `_` instead of a space for an empty slot at the cursor.

Priorities 2–3 are informational warnings, not blocks.  The player can still
submit a word that violates known constraints (hard-mode enforcement is handled
by `game.makeMove`, not the input layer).

---

## Pool hint

After the tile row, a pool hint shows letters that are known to be in the word
but not yet accounted for by the current buffer:

- **Bold green foreground** — letter confirmed at a specific position (`known[i]`)
  but the buffer does not yet have that letter at that position.
- **Yellow foreground** — letter required to appear somewhere (`minCounts`) but
  unplaced in the current buffer.

The hint is omitted when empty.  It is displayed to the right of the tile row,
separated by five spaces.

---

## Key bindings

| Key | Condition | Action |
| --- | --------- | ------ |
| `a`–`z` / `A`–`Z` | cursor < 5 | Write letter at cursor; advance cursor |
| `a`–`z` / `A`–`Z` | cursor = 5 | No-op |
| Space | cursor < 5 | Clear slot at cursor; advance cursor (forward delete) |
| Space | cursor = 5 | No-op |
| Backspace / Delete | cursor > 0 | Clear slot at cursor−1; move cursor left |
| Backspace / Delete | cursor = 0 | No-op |
| `←` (left arrow) | cursor > 0 | Move cursor left |
| `←` (left arrow) | cursor = 0 | No-op |
| `→` (right arrow) | cursor < 5 | Move cursor right (may advance into empty territory) |
| `→` (right arrow) | cursor = 5 | No-op |
| Tab | any | Fill all confirmed-green positions from `constraints.known`; cursor → first empty slot (or 5 if full) |
| `1`–`6` | suggestion exists | Replace buffer with that suggestion word; cursor → 5; **do not submit** |
| `1`–`6` | no such suggestion | No-op |
| Enter | all 5 slots filled | Submit: finalise tile row, advance line, return word to caller |
| Enter | any slot empty | No-op |
| Ctrl+C | any | Restore terminal cursor; exit process |
| Other escape sequences | any | No-op (silently ignored) |

The cursor may sit at position 5 (one past the last slot) — this is a valid
resting state after filling or loading a full word.  Typing is a no-op there;
backspace clears slot 4 and moves to cursor 4.

---

## In-place grading

When the player presses Enter with a complete word:

1. Call `game.makeMove(word)`.
2. If the result is invalid (wrong length, not in list, hard-mode violation):
   - `\n` to leave the invalid attempt visible, then print the error message.
   - Print a fresh prompt + blank tile row (no newline) and resume input.
3. If valid: `\r` + write the prompt + `writeGuessResult(word, pattern)` in
   the scored colours, then `\n` to finalise.

The final appearance of a completed turn is:

```text
Guess 1/6:  T  I  R  E  D
```

This keeps graded rows visually identical to those produced by the line-buffered
path, so the two modes are indistinguishable in the scrollback.

---

## TerminalIO abstractions

`TerminalIO` (base class) owns all slot/pool computation and ANSI rendering.
`NodeTerminal` and `XtermTerminal` each implement `write()`, `readLine()`, and
`readWordRaw()`.  `GameRunner` is agnostic to the concrete subclass.

### `_computePending(word, constraints, cursor = -1)`

Pure computation — no ANSI, no platform specifics.

```text
word        — string (0–5 chars) or (string|null)[] (5 elements, null = empty slot)
constraints — ConstraintState
cursor      — slot index 0–4 for cursor highlight; -1 = none
→ { slots, pool }
```

`slots` — 5-element array of `{ kind, letter, atCursor }` where `kind` is one
of `'green' | 'yellow-tile' | 'grey' | 'yellow-fg' | 'default' | 'empty'`.

`pool` — array of `{ kind: 'green-unplaced' | 'yellow-unplaced', letter }`.
Green-unplaced entries appear first (in position order); yellow-unplaced entries
follow (alphabetically).

### `_slotsToAnsi(slots)` / `_poolToAnsi(pool)`

Convert the structured output of `_computePending` to ANSI strings for CLI
rendering.  HTML or React renderers consume `_computePending` directly and skip
these methods.

### `_renderPendingLine(prompt, word, constraints, cursor = -1)`

Overwrites the current terminal line with `\r` + prompt + tile row + pool hint +
`ESC[K`.  Calls `_computePending`, `_slotsToAnsi`, and `_poolToAnsi` internally.

### `_handleWordKey(rawKey, buffer, cursor, suggestions, constraints)`

Pure state-transition function.  No I/O side effects.

```text
rawKey      — raw key string from stdin / xterm onData
buffer      — (string|null)[] 5-element array
cursor      — current insertion point 0–5
suggestions — string[] words mapped to keys 1–6
constraints — ConstraintState (required for Tab; ignored otherwise)
→ { buffer, cursor, done, exit }
```

### `readWordRaw(prompt, constraints, suggestions = [])`

Node: enters raw mode, hides cursor, runs the key loop, restores on exit.
Xterm: registers `_rawModeHandler` on the shared `onData` listener.
Both fall back to `readLine` when raw input is unavailable.

---

## ANSI codes used

| Name | Sequence | Use |
| ---- | -------- | --- |
| green bg | `ESC[42m ESC[1m ESC[97m` | Green tile |
| yellow bg | `ESC[43m ESC[1m ESC[30m` | Yellow tile |
| grey bg | `ESC[100m ESC[1m ESC[97m` | Grey tile |
| yellow fg | `ESC[33m` | Yellow-fg tile; yellow pool items |
| green fg | `ESC[1m ESC[32m` | Green pool items |
| underline | `ESC[4m` | Cursor highlight (prepended to tile) |
| reset | `ESC[0m` | End of every styled cell |
| erase to EOL | `ESC[K` | Clear after tile row on each re-render |
| hide cursor | `ESC[?25l` | On raw-mode entry |
| show cursor | `ESC[?25h` | On raw-mode exit (including Ctrl+C) |

---

## Deferred items

- **Quickplay explanation** — per-suggestion ranking annotations; cleaner once
  the HTML UI has a dedicated annotations lane.
- **Terminal background detection** — OSC 11 probe; mid-range colour palette as
  default; `--theme` flag override.
