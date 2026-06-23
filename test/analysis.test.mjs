import { describe, it, expect } from 'vitest';
import { runSimulation, summarize, formatSummary } from '../src/lib/analysis.mjs';
import { FirstWordStrategy } from '../src/lib/strategy.mjs';
import { TEST_WORDS } from '../src/lib/wordlist.mjs';

// Helpers for building hand-crafted result sets.
const solved = (answer, ...guesses) => ({
  answer, guesses, solved: true, turns: guesses.length,
});
const failed = (answer, ...guesses) => ({
  answer, guesses, solved: false, turns: guesses.length,
});

describe('summarize', () => {
  it('all solved', () => {
    const summary = summarize([
      solved('crane', 'slate', 'crane'),
      solved('toast', 'crane', 'toast'),
      solved('light', 'crane', 'slate', 'light'),
    ]);
    expect(summary.total).toBe(3);
    expect(summary.solvedCount).toBe(3);
    expect(summary.failedCount).toBe(0);
    expect(summary.solveRate).toBe(1);
    expect(summary.failures).toHaveLength(0);
  });

  it('all failed', () => {
    const summary = summarize([
      failed('xylyl', 'a', 'b', 'c', 'd', 'e', 'f'),
      failed('kudzu', 'a', 'b', 'c', 'd', 'e', 'f'),
    ]);
    expect(summary.solvedCount).toBe(0);
    expect(summary.failedCount).toBe(2);
    expect(summary.solveRate).toBe(0);
    expect(Number.isNaN(summary.meanSolved)).toBe(true);
    expect(summary.failures).toHaveLength(2);
  });

  it('mixed solved and failed', () => {
    const summary = summarize([
      solved('crane', 'crane'),
      failed('xylyl', 'a', 'b', 'c', 'd', 'e', 'f'),
    ]);
    expect(summary.solvedCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.solveRate).toBe(0.5);
  });

  it('computes mean correctly', () => {
    const summary = summarize([
      solved('a', 'x', 'a'),         // 2 turns
      solved('b', 'x', 'y', 'b'),    // 3 turns
      solved('c', 'x', 'y', 'z', 'c'), // 4 turns
    ]);
    expect(summary.meanSolved).toBeCloseTo((2 + 3 + 4) / 3);
  });

  it('computes min and max from solved games only', () => {
    const summary = summarize([
      solved('a', 'a'),              // 1 turn
      solved('b', 'x', 'y', 'b'),   // 3 turns
      failed('c', 'x', 'y', 'z', 'w', 'v', 'u'), // not counted
    ]);
    expect(summary.min).toBe(1);
    expect(summary.max).toBe(3);
  });

  it('builds distribution correctly', () => {
    const summary = summarize([
      solved('a', 'a'),           // 1 turn
      solved('b', 'x', 'b'),      // 2 turns
      solved('c', 'x', 'c'),      // 2 turns
      solved('d', 'x', 'y', 'd'), // 3 turns
    ]);
    expect(summary.distribution[1]).toBe(1);
    expect(summary.distribution[2]).toBe(2);
    expect(summary.distribution[3]).toBe(1);
    expect(summary.distribution[4]).toBeUndefined();
  });
});

describe('formatSummary', () => {
  const allSolved = summarize([
    solved('crane', 'crane'),
    solved('toast', 'slate', 'toast'),
    solved('light', 'crane', 'slate', 'light'),
  ]);

  it('includes the strategy name', () => {
    expect(formatSummary(allSolved, 'TestStrategy')).toContain('TestStrategy');
  });

  it('includes game count and solve rate', () => {
    const text = formatSummary(allSolved);
    expect(text).toContain('3');
    expect(text).toContain('100.0%');
  });

  it('includes a distribution section', () => {
    expect(formatSummary(allSolved)).toContain('Distribution');
  });

  it('omits failure section when all games are solved', () => {
    expect(formatSummary(allSolved)).not.toContain('Failure');
  });

  it('includes failure section when games failed', () => {
    const withFailure = summarize([
      solved('crane', 'crane'),
      failed('xylyl', 'a', 'b', 'c', 'd', 'e', 'f'),
    ]);
    expect(formatSummary(withFailure)).toContain('xylyl');
  });
});

describe('runSimulation', () => {
  const answers = TEST_WORDS.slice(0, 5);

  it('runs one game per answer', () => {
    const results = runSimulation(() => new FirstWordStrategy(), TEST_WORDS, { answers });
    expect(results).toHaveLength(answers.length);
  });

  it('each result records the correct answer', () => {
    const results = runSimulation(() => new FirstWordStrategy(), TEST_WORDS, { answers });
    expect(results.map(r => r.answer)).toEqual(answers);
  });

  it('solves games where the answer is in the word list', () => {
    const results = runSimulation(() => new FirstWordStrategy(), TEST_WORDS, { answers });
    expect(results.every(r => r.solved)).toBe(true);
  });

  it('calls onProgress once per game', () => {
    const calls = [];
    runSimulation(() => new FirstWordStrategy(), TEST_WORDS, {
      answers,
      onProgress: (i, total, answer) => calls.push({ i, total, answer }),
    });
    expect(calls).toHaveLength(answers.length);
    expect(calls[0]).toEqual({ i: 1, total: answers.length, answer: answers[0] });
    expect(calls.at(-1).i).toBe(answers.length);
  });
});
