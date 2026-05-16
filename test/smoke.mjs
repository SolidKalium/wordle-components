/**
 * Smoke test — exercises core, constraints, game, strategy, and analysis
 * against the built-in test word list.
 *
 * Run: node test/smoke.mjs
 */

import {
  GREEN, YELLOW, GREY,
  computePattern, patternToString, patternFromString,
  patternToInt, patternFromInt,
  partitionByGuess,
} from '../src/core.mjs';
import { ConstraintState } from '../src/constraints.mjs';
import { Game, MoveResult } from '../src/game.mjs';
import { RandomStrategy, FirstWordStrategy } from '../src/strategy.mjs';
import { runSimulation, summarize, formatSummary } from '../src/analysis.mjs';
import { TEST_WORDS } from '../src/wordlist.mjs';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function section(name) {
  console.log(`\n--- ${name} ---`);
}

// ── Core ──

section('computePattern');

// Basic exact match
assert(
  patternToString(computePattern('crane', 'crane')) === 'GGGGG',
  'exact match → all green',
);

// No matches
assert(
  patternToString(computePattern('slate', 'funny')) === '_____',
  'no overlap → all grey',
);

// Duplicate letter handling: guess has 3 E's, answer has 1 (at pos 4)
// Green claims the match at pos 4; no unclaimed e's left → rest grey
assert(
  patternToString(computePattern('geese', 'crane')) === '____G',
  'duplicate guess letter, single in answer → green claims it, excess grey',
);

// Duplicate: answer has 2 E's
assert(
  patternToString(computePattern('geese', 'creep')) === '_YG__',
  'duplicate letter in both → green claims first, yellow second, grey excess',
);

// Pattern encoding round-trip
const pat = [GREEN, YELLOW, GREY, GREY, GREEN];
assert(
  patternToString(patternFromInt(patternToInt(pat))) === patternToString(pat),
  'int encoding round-trip',
);

section('partitionByGuess');

const partition = partitionByGuess('crane', TEST_WORDS);
const totalPartitioned = [...partition.values()].reduce((s, arr) => s + arr.length, 0);
assert(
  totalPartitioned === TEST_WORDS.length,
  'partition covers all words',
);
console.log(`  'crane' splits ${TEST_WORDS.length} words into ${partition.size} groups`);
const biggest = Math.max(...[...partition.values()].map(g => g.length));
console.log(`  largest group: ${biggest} words`);

// ── Constraints ──

section('ConstraintState');

const cs = new ConstraintState();
// Simulate guessing "crane" against answer "ghost"
cs.update('crane', computePattern('crane', 'ghost'));
assert(!cs.matches('crane'), 'crane excluded after feedback from ghost');
assert(cs.matches('ghost'), 'ghost still matches');
assert(!cs.matches('grace'), 'grace ruled out (has c/r/a/e)');

// Auto-promotion: exclude a letter from 4 positions, require it
const cs2 = new ConstraintState();
// Fake a scenario: letter 'x' is yellow at pos 0, then excluded from 1,2,3
// by subsequent guesses. Should auto-promote to pos 4.
cs2.update('xbcde', [YELLOW, GREY, GREY, GREY, GREY]);
cs2.update('fxghi', [GREY, YELLOW, GREY, GREY, GREY]);
cs2.update('jkxlm', [GREY, GREY, YELLOW, GREY, GREY]);
cs2.update('nopxq', [GREY, GREY, GREY, YELLOW, GREY]);
// x excluded from 0,1,2,3 → must be at 4
assert(cs2.known[4] === 'x', 'auto-promotion to last open position');

// ── Game ──

section('Game (answer-known mode)');

const g1 = new Game({ answer: 'toast', wordList: TEST_WORDS });
let result = g1.makeMove('crane');
assert(result.valid, 'valid first guess');
assert(!g1.solved, 'not solved yet');
assert(!g1.isOver, 'game still going');

result = g1.makeMove('toast');
assert(result.valid, 'valid guess');
assert(g1.solved, 'solved on correct guess');
assert(g1.isOver, 'game over after solve');
assert(g1.guesses.length === 2, 'two guesses recorded');

section('Game (validation)');

const g2 = new Game({ answer: 'crane', wordList: TEST_WORDS });
assert(g2.checkMove('xx').error === MoveResult.WRONG_LENGTH, 'reject wrong length');
assert(g2.checkMove('zzzzz').error === MoveResult.NOT_IN_LIST, 'reject non-word');

section('Game (hard mode)');

const g3 = new Game({ answer: 'grain', wordList: TEST_WORDS, hardMode: true });
g3.makeMove('crane');
// crane vs grain → _YG__ — r is yellow (pos 1), a is green (pos 2)
// next guess must include r and have a at position 2
const hardCheck = g3.checkMove('toast');
assert(
  hardCheck.error === MoveResult.HARD_MODE_KNOWN || hardCheck.error === MoveResult.HARD_MODE_REQUIRED,
  'hard mode rejects guess missing revealed letters',
);

section('Game (external mode)');

const g4 = new Game({ wordList: TEST_WORDS });
assert(g4.mode === 'external', 'external mode when no answer');
result = g4.makeMove('crane', [GREY, GREY, GREY, GREY, GREY]);
assert(result.valid, 'external mode accepts pattern');

// ── Strategy + Analysis ──

section('Simulation (FirstWordStrategy on test words)');

const simResults = runSimulation(
  () => new FirstWordStrategy(),
  TEST_WORDS,
  { answers: TEST_WORDS.slice(0, 20) }, // quick run on 20 words
);
const summary = summarize(simResults);
console.log(formatSummary(summary, 'FirstWordStrategy (20 words)'));
assert(summary.total === 20, 'ran 20 games');
assert(summary.solvedCount > 0, 'solved at least some');

// ── Report ──

console.log(`\n${'='.repeat(40)}`);
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
