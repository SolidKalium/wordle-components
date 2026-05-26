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
Guess N/6:  _  _  _  _  _   ← prompt + tile row on one line (overwritten in-place)
  1.word  2.word …           ← suggestions (quickplay only, printed after grading)
  N words remain.            ← explanation (basic+explain only, printed after grading)
```

The prompt and tile row share a single line.  Every re-render uses `\r` to return
to the start of that line and rewrites both together.  On submission `\n` advances
past the finalised line before suggestions/explanation are appended.

Empty positions render as `   ` (three spaces, no background).

---

## Per-letter styling during input

Uses `ConstraintState` to colour each typed letter in the tile row before the
word is submitted.  Priority order (first match wins):

| Priority | Condition | Style |
| -------- | --------- | ----- |
| 1 | `known[i] === letter` | Green tile — confirmed at this position |
| 2 | `excluded[i].has(letter) && !eliminated.has(letter)` | Yellow tile — in word, but not here (soft warning) |
| 3 | `eliminated.has(letter)` | Grey tile — not in word (soft warning) |
| 4 | `minCounts.has(letter)` (required, position untested) | Yellow foreground, default background |
| 5 | otherwise | Default foreground and background |

Priorities 2–3 are informational warnings, not blocks.  The player can still
submit a word that violates known constraints (hard-mode enforcement is handled
by `game.makeMove`, not by the input layer).

The tile format matches `writeGuessResult`: ` L ` (space–letter–space) per cell,
letter uppercased.

---

## Key bindings

| Key | Buffer length | Action |
| --- | ------------- | ------ |
| `a`–`z` / `A`–`Z` | < 5 | Append letter; re-render tile row |
| `a`–`z` / `A`–`Z` | = 5 | No-op (buffer full) |
| Backspace / Delete | > 0 | Remove last letter; re-render tile row |
| Backspace / Delete | = 0 | No-op |
| `1`–`6` | any | Replace buffer with that suggestion word (if it exists); re-render; **do not submit** |
| Enter | = 5 | Submit: finalise tile row, advance line, return word to caller |
| Enter | < 5 | No-op (word not complete) |
| Ctrl+C | any | Restore terminal state; exit process |

Number keys require that the corresponding suggestion exists.  If the player
presses `3` when only two suggestions are shown, it is a no-op.

Cursor navigation within the buffer (arrow keys, overwrite-at-position) is
deferred; see [Deferred items](#deferred-items).

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

Initially implemented only in `NodeTerminal`.  Methods that belong in the shared
`TerminalIO` base will be extracted once the Node implementation is stable.

### New shared method (belongs in `TerminalIO`)

```js
/**
 * Render a partially-typed word as a tile row, without a trailing newline.
 * Uses \r to overwrite the current line.
 *
 * @param {string}           word        Letters typed so far (0–5 chars).
 * @param {ConstraintState}  constraints Current game constraints.
 */
writePendingWord(word, constraints) { … }
```

Colour logic: see [Per-letter styling](#per-letter-styling-during-input).
Untyped positions render as `   ` (three spaces).

### New NodeTerminal method (Node-specific)

```js
/**
 * Enter raw mode and read one complete word from the player.
 *
 * Re-renders the tile row on every keystroke.  Suspends readline while
 * active; restores it on return.
 *
 * @param {string}           prompt       e.g. "Guess 1/6:"
 * @param {ConstraintState}  constraints  For per-letter colouring.
 * @param {string[]}         suggestions  Words for number-key shortcut (may be empty).
 * @returns {Promise<string>}             The submitted 5-letter word.
 */
readWordRaw(prompt, constraints, suggestions) { … }
```

`readLine` continues to exist for non-raw contexts (error messages, test
doubles).  `GameRunner` calls `readWordRaw` when `process.stdin.isTTY` is true
and falls back to `readLine` otherwise.

---

## ANSI additions

`TerminalIO` currently defines tile colours for scored output.  The pending-word
renderer needs one additional entry:

```js
yellowFg: '[33m',   // yellow foreground, no background change — "letter in word, position untested"
```

The existing `reset` entry (`[0m`) clears it.

---

## Deferred items

These are noted here to avoid re-litigating scope during implementation:

- **Cursor navigation** — arrow keys move an insertion point within the buffer;
  typing overwrites the selected position and advances.  Requires tracking caret
  index through re-renders and handling multi-byte arrow-key escape sequences.
- **Position indicator** — a visual caret (underline, half-block, or blinking)
  marking the active position, contingent on cursor navigation.
- **Hint line** — a secondary display (right of tiles or below) showing known
  letters not yet placed, with green letters optionally pre-populated.
- **Quickplay explanation** — per-suggestion ranking annotations shown after a
  choice; cleaner with cursor navigation in place so annotations can underlay
  the suggestion list rather than pushing it.
- **Terminal background detection** — OSC 11 probe; mid-range colour palette as
  default; `--theme` flag override.
