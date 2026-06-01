# CLI Interaction Spec

Describes the raw-mode input behaviour for the Node CLI (`NodeTerminal`).
Line-buffered fallback (readline) is used when `process.stdin.isTTY` is false
(pipes, CI, test doubles).

---

## Modes and applicability

| Mode       | Suggestions | Explain | Raw input          |
|------------|-------------|---------|--------------------|
| Basic      | no          | opt-in  | yes (word input)   |
| Quickplay  | yes         | (later) | yes (word input)   |
| Grade      | n/a         | opt-in  | yes (grading block)|

Raw mode applies to different steps depending on mode.  Sections below cover
both the "player guesses a computer-chosen word" flow (Basic/Quickplay) and
the "computer guesses, player grades" flow (Grade).

---

## Screen layout per turn — Basic / Quickplay

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

## Key bindings — Basic / Quickplay

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

## In-place grading — Basic / Quickplay

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

## Grading mode — screen layout

The computer guesses; the player grades each letter.  Raw input is used for the
grading block rather than word entry.  The block occupies three terminal rows:

```text
              ▁▁▁            ▁▁▁   ← top hint row: lower-eighth strips in Up-cycle colour
Guess N/6:  C  R  A  N  E     N words possible
              ▔▔▔            ▔▔▔   ← bottom hint row: upper-eighth strips in Down-cycle colour
```

- **Top hint row** — shows what pressing Up (or W) would cycle the slot to, using
  `▁▁▁` (U+2581 LOWER ONE EIGHTH BLOCK) in the foreground colour of the target
  state.  The strip sits flush against the tile row below.
- **Tile row** — the computer's guessed word with each letter coloured according
  to the current grading state.  The active cursor slot is underlined.
  An optional annotation (words remaining, or a validation error) appears to
  the right.
- **Bottom hint row** — shows what pressing Down (or S) would cycle the slot to,
  using `▔▔▔` (U+2594 UPPER ONE EIGHTH BLOCK) flush against the tile row above.

Non-cursor slots in both hint rows are dimmed (`ESC[2m`) so the active slot
stands out.  Fixed slots (where existing constraints fully determine the colour)
render as three spaces in both hint rows — they cannot be changed.

On the first render the block is written from the current cursor position.
Subsequent renders reposition with `ESC[2A` to overwrite all three rows in place.
On submission or undo the block is collapsed with `ESC[2A\r ESC[J`.

---

## Grading mode — fixed vs. editable slots

`_computeGradingSlots` determines which slots are fixed before the grading block
appears.  A slot is fixed when existing constraints fully determine its colour:

| Condition | Fixed colour |
| --------- | ------------ |
| `constraints.known[i] === letter` | Green |
| `constraints.isExhausted(letter)` | Grey |
| `constraints.excluded[i].has(letter)` | Yellow |

A fixed slot's `allowed` array contains only its fixed colour; its hint-row
cells are always blank.  Editable slots start grey and cycle through
`[GREY, YELLOW, GREEN]` (green omitted when a different letter is confirmed at
that position).

---

## Key bindings — Grading mode

| Key | Condition | Action |
| --- | --------- | ------ |
| `↑` / `W` | slot not fixed | Cycle colour forward: grey → yellow → green → grey |
| `↓` / `S` | slot not fixed | Cycle colour backward: grey → green → yellow → grey |
| `←` / `A` | any | Move cursor left, skipping fixed slots |
| `→` / `D` / Space | any | Move cursor right, skipping fixed slots |
| `G` / `g` | slot not fixed, green in allowed | Set slot green; advance cursor (skip fixed) |
| `Y` / `y` | slot not fixed | Set slot yellow; advance cursor (skip fixed) |
| Backspace | slot not fixed, not already grey | Reset slot to grey |
| Enter | — | Validate and submit; show error if constraint violated |
| Ctrl+Z | — | Undo: collapse block, signal GradingRunner to undo last committed word |
| Ctrl+C | — | Restore terminal cursor; exit process |
| Other keys / ESC sequences | — | No-op |

**Cursor movement** skips fixed slots in the direction of travel, stopping at
the first non-fixed slot found.  If no non-fixed slot exists further in that
direction the cursor does not move.

**Validation on Enter** — `_validateGradingSlots` checks cross-letter count
constraints against `constraints.maxCounts` and `constraints.minCounts`.
(Per-slot state is already enforced by the fixed/allowed system, so only
aggregate count errors remain.)  If invalid, the error is shown in red in
the annotation space with escalating `!` marks on repeated Enter presses
(one `!` → two `!` → three `!` → cycles back).

---

## Grading mode — undo

Pressing Ctrl+Z during grading:
1. `readGradingRaw` collapses the block (`ESC[2A\r ESC[J`), restores the
   terminal cursor, and resolves with `null`.
2. `GradingRunner` sees `null`, calls `game.undoMove()` to pop the last
   committed guess and rebuild constraints.
3. The runner then erases the committed result line plus any warning lines that
   appeared before it, using the formula:
   `warningLines(current iteration) + 1 + warningLines(preceding the undone move)`.
4. The undone word is re-presented as the next guess (no re-computation).

If there is nothing to undo (first turn), the same word is simply re-presented.

---

## Grading mode — pool exhaustion

After each committed guess, `GradingRunner` filters the answer list against the
current constraints.

1. **Answers exhausted** — if no answer-list word matches, a one-time warning is
   printed and the runner falls back to the full valid-word list.  The warning is
   suppressed on subsequent turns until the player undoes above the point where it
   first appeared.

2. **Full list exhausted** — if even the full word list yields no matches,
   `readUndoOrQuit` is called:
   - Ctrl+Z → undo the last committed word (see Undo section above).
   - Enter / Ctrl+C → end the session.

In auto-play mode (`-w` flag), full exhaustion prints a diagnostic line and
exits the loop immediately.

---

## Grading mode — auto-play (`-w`)

When a word is supplied with `-w`, `GradingRunner` constructs a `Game` with
`answer` set.  Each turn the game grades itself via `game.makeMove(guess)` and
the result is printed immediately — no interactive grading block is shown.
The `-e` flag appends a word-count annotation to each committed line.

---

## TerminalIO abstractions

`TerminalIO` (base class) owns all slot/pool computation and ANSI rendering.
`NodeTerminal` and `XtermTerminal` each implement `write()`, `readLine()`,
`readWordRaw()`, `readGradingRaw()`, and `readUndoOrQuit()`.
`GameRunner` and `GradingRunner` are agnostic to the concrete subclass.

### Word-input methods

#### `_computePending(word, constraints, cursor = -1)`

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

#### `_slotsToAnsi(slots)` / `_poolToAnsi(pool)`

Convert the structured output of `_computePending` to ANSI strings for CLI
rendering.  HTML or React renderers consume `_computePending` directly and skip
these methods.

#### `_renderPendingLine(prompt, word, constraints, cursor = -1)`

Overwrites the current terminal line with `\r` + prompt + tile row + pool hint +
`ESC[K`.  Calls `_computePending`, `_slotsToAnsi`, and `_poolToAnsi` internally.

#### `_handleWordKey(rawKey, buffer, cursor, suggestions, constraints)`

Pure state-transition function.  No I/O side effects.

```text
rawKey      — raw key string from stdin / xterm onData
buffer      — (string|null)[] 5-element array
cursor      — current insertion point 0–5
suggestions — string[] words mapped to keys 1–6
constraints — ConstraintState (required for Tab; ignored otherwise)
→ { buffer, cursor, done, exit }
```

#### `readWordRaw(prompt, constraints, suggestions = [])`

Node: enters raw mode, hides cursor, runs the key loop, restores on exit.
Xterm: registers `_rawModeHandler` on the shared `onData` listener.
Both fall back to `readLine` when raw input is unavailable.

---

### Grading methods

#### `_computeGradingSlots(word, constraints)`

Pure computation.  Returns a 5-element array of
`{ letter, state, fixed, allowed }` where `state` is the current colour
constant (`GREEN | YELLOW | GREY`), `fixed` is a boolean, and `allowed` is the
ordered cycle array (single-element for fixed slots).

#### `_gradingSlotsToAnsi(slots, cursor = -1)`

Converts the slots array to an ANSI tile-row string.  The slot at `cursor`
receives an underline prefix.

#### `_hintRowAnsi(slots, dir, cursor = -1)`

Builds one hint-row ANSI string.  `dir = +1` → top row (`▁▁▁`, lower-eighth
block, fg = colour of Up-cycle target).  `dir = -1` → bottom row (`▔▔▔`,
upper-eighth block, fg = colour of Down-cycle target).  Non-cursor editable
slots are dimmed; fixed slots render as three spaces.

#### `_renderGradingBlock(prompt, slots, cursor, error, remainingCount, firstRender)`

Renders the three-row grading block.  On `firstRender = false` prepends
`ESC[2A` to overwrite the previous block in place.  The annotation on the
middle row shows `error` (red) if set, otherwise `remainingCount` (plain text)
if provided.

#### `_validateGradingSlots(slots, constraints)`

Returns an error string if the current slot states violate known count
constraints (`maxCounts` / `minCounts`), or `null` if valid.

#### `_gradingMoveCursor(slots, cursor, dir)`

Returns the next cursor position in direction `dir` (+1 or -1), skipping fixed
slots.  Does not move past position 0 or 4.

#### `_handleGradingKey(rawKey, slots, cursor, constraints, errorPressCount = 0)`

Pure state-transition function.

```text
→ { slots, cursor, done, exit, undo, error, errorPressCount }
```

`done: true` means Enter was pressed and validation passed.  `undo: true` means
Ctrl+Z was pressed.  `exit: true` means Ctrl+C was pressed.

#### `readGradingRaw(prompt, word, constraints, remainingCount = null)`

Renders the grading block and drives the key loop until done, undo, or exit.
Returns the 5-element pattern array (`GREEN | YELLOW | GREY` per slot) on
success, or `null` to signal undo to the caller.

Node: enters raw mode; Xterm: uses `_rawModeHandler`.  If `cursor === -1` on
entry (all slots fixed), resolves immediately without entering raw mode.

#### `readUndoOrQuit(message)`

Writes `message` then waits for the player to press Ctrl+Z (`→ 'undo'`) or
Enter / Ctrl+C (`→ 'quit'`).  Used by `GradingRunner` when the word pool is
fully exhausted.

#### `writeGuessResult(word, pattern, suffix = '')`

Writes a single scored tile row followed by `ESC[K` and a newline.  `suffix`
is appended after the tiles (used by `-e` to show word count in grade mode).

---

## ANSI codes used

| Name | Sequence | Use |
| ---- | -------- | --- |
| green bg | `ESC[42m ESC[1m ESC[97m` | Green tile |
| yellow bg | `ESC[43m ESC[1m ESC[30m` | Yellow tile |
| grey bg | `ESC[100m ESC[1m ESC[97m` | Grey tile |
| yellow fg | `ESC[33m` | Yellow-fg tile; yellow pool items; yellow hint strip |
| green fg | `ESC[1m ESC[32m` | Green pool items |
| grey fg | `ESC[90m` | Grey hint strip |
| underline | `ESC[4m` | Cursor highlight (prepended to tile) |
| dim | `ESC[2m` | Non-cursor hint-row strips in grading block |
| red fg | `ESC[31m` | Validation error annotation |
| reset | `ESC[0m` | End of every styled cell |
| erase to EOL | `ESC[K` | Clear after tile row on each re-render |
| cursor up N | `ESC[2A` | Reposition to top of grading block on re-render |
| hide cursor | `ESC[?25l` | On raw-mode entry |
| show cursor | `ESC[?25h` | On raw-mode exit (including Ctrl+C) |

---

## Deferred items

- **Quickplay explanation** — per-suggestion ranking annotations; cleaner once
  the HTML UI has a dedicated annotations lane.
- **Terminal background detection** — OSC 11 probe; mid-range colour palette as
  default; `--theme` flag override.
