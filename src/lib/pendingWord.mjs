/**
 * Pure computation for a partially-typed Wordle word.
 * Renderer-agnostic — consumed by the CLI (TerminalIO) and the HTML/React UI.
 *
 * @param {string|(string|null)[]} word
 *   Letters typed so far. Either a plain string (positions past its length are
 *   empty) or a 5-element array where null means "empty slot".
 * @param {import('./constraints.mjs').ConstraintState} constraints
 * @param {number} [cursor=-1]  Slot index (0–4) for cursor highlight; -1 = none.
 * @returns {{
 *   slots: Array<{kind: string, letter: string|null, atCursor: boolean}>,
 *   pool:  Array<{kind: 'green-unplaced'|'yellow-unplaced', letter: string}>
 * }}
 *
 * Slot kinds:
 *   'empty'       — no letter typed; placeholder tile
 *   'green'       — letter confirmed correct at this position
 *   'grey'        — letter eliminated (or this copy exhausted by greens)
 *   'yellow-tile' — letter is present, but wrong position (yellow bg)
 *   'yellow-fg'   — letter is known in the word, position uncertain (yellow text, blank bg)
 *   'default'     — typed letter with no constraint information yet
 */
export function computePendingSlots(word, constraints, cursor = -1) {
  // Pre-compute confirmed positions per letter for exhaustion checks and pool calc.
  const knownCount = new Map();
  for (const L of constraints.known) {
    if (L) knownCount.set(L, (knownCount.get(L) ?? 0) + 1);
  }

  // Pass 1: assign high-priority colours per position.
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const letter = word[i] ?? null;
    if (!letter) { slots.push({ kind: 'empty', letter: null }); continue; }
    if (constraints.known[i] === letter) { slots.push({ kind: 'green', letter }); continue; }

    if (constraints.isExhausted(letter)) {
      slots.push({ kind: 'grey', letter }); continue;
    }

    if (constraints.excluded[i].has(letter)) { slots.push({ kind: 'yellow-tile', letter }); continue; }
    slots.push({ kind: 'candidate', letter });
  }

  // Pass 2: assign yellow-fg within pool (left-to-right through candidates).
  // Pool = minCounts[L] − knownCount[L]; yellow-tile slots don't consume pool.
  const yellowFgUsed = new Map();
  for (const s of slots) {
    if (s.kind !== 'candidate') continue;
    const L    = s.letter;
    const pool = Math.max(0,
      (constraints.minCounts.get(L) ?? 0) -
      (knownCount.get(L)            ?? 0),
    );
    const used = yellowFgUsed.get(L) ?? 0;
    s.kind = used < pool ? 'yellow-fg' : 'default';
    if (s.kind === 'yellow-fg') yellowFgUsed.set(L, used + 1);
  }

  // Pass 3: yellow-tile → grey when the pool for this letter is exhausted.
  for (const s of slots) {
    if (s.kind !== 'yellow-tile') continue;
    const L    = s.letter;
    const pool = Math.max(0,
      (constraints.minCounts.get(L) ?? 0) -
      (knownCount.get(L)            ?? 0),
    );
    if ((yellowFgUsed.get(L) ?? 0) >= pool) {
      s.kind = 'grey';
    }
  }

  // Attach cursor flag.
  const slotsWithCursor = slots.map((s, i) => ({
    ...s,
    atCursor: cursor >= 0 && cursor < 5 && i === cursor,
  }));

  // Build pool — greens in position order, then yellow remainders alphabetically.
  const pool = [];
  for (let i = 0; i < 5; i++) {
    const L = constraints.known[i];
    if (L && slots[i].kind !== 'green') {
      pool.push({ kind: 'green-unplaced', letter: L });
    }
  }
  const yellowRemaining = [];
  for (const [L, total] of constraints.minCounts) {
    const poolSize  = Math.max(0, total - (knownCount.get(L) ?? 0));
    const remaining = poolSize - (yellowFgUsed.get(L) ?? 0);
    for (let i = 0; i < remaining; i++) yellowRemaining.push(L);
  }
  yellowRemaining.sort();
  for (const L of yellowRemaining) {
    pool.push({ kind: 'yellow-unplaced', letter: L });
  }

  return { slots: slotsWithCursor, pool };
}
