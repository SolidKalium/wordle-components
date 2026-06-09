import { Game } from './game.mjs';
import { partitionByGuess, ALL_GREEN_STR, MAX_GUESSES } from './core.mjs';

/**
 * Run a strategy against every word in an answer set and collect results.
 *
 * @param {() => import('./strategy.mjs').Strategy} strategyFactory
 *   Factory that returns a fresh strategy instance per game.
 * @param {string[]} wordList - Full valid word list.
 * @param {object}   [opts]
 * @param {string[]} [opts.answers]   - Answer set to test against (defaults to wordList).
 * @param {boolean}  [opts.hardMode]  - Run in hard mode.
 * @param {(i: number, total: number, answer: string) => void} [opts.onProgress]
 *   Called after each game completes.
 * @returns {SimulationResult[]}
 */
export function runSimulation(strategyFactory, wordList, opts = {}) {
  const { answers = wordList, hardMode = false, onProgress } = opts;
  const results = [];

  for (let i = 0; i < answers.length; i++) {
    const answer = answers[i];
    const strategy = strategyFactory();
    const game = new Game({ answer, wordList, hardMode });
    let remaining = wordList; // no filtering needed before first guess

    while (!game.isOver) {
      const guess = strategy.chooseGuess(game, remaining, remaining);
      game.makeMove(guess);
      remaining = remaining.filter(w => game.constraints.matches(w));
    }

    results.push({
      answer,
      guesses: game.guesses.map(g => g.word),
      solved: game.solved,
      turns: game.guesses.length,
    });

    onProgress?.(i + 1, answers.length, answer);
  }

  return results;
}

/**
 * @typedef {object} SimulationResult
 * @property {string}   answer
 * @property {string[]} guesses
 * @property {boolean}  solved
 * @property {number}   turns
 */

/**
 * Compute summary statistics from simulation results.
 *
 * @param {SimulationResult[]} results
 * @returns {SimulationSummary}
 */
export function summarize(results) {
  const total = results.length;
  const solved = results.filter(r => r.solved);
  const failed = results.filter(r => !r.solved);

  const turns = solved.map(r => r.turns);
  turns.sort((a, b) => a - b);

  const sum = turns.reduce((a, b) => a + b, 0);
  const mean = turns.length > 0 ? sum / turns.length : NaN;
  const median = turns.length > 0 ? turns[Math.floor(turns.length / 2)] : NaN;
  const min = turns.length > 0 ? turns[0] : NaN;
  const max = turns.length > 0 ? turns[turns.length - 1] : NaN;

  // Distribution: how many games solved in 1, 2, 3, ... turns
  const distribution = {};
  for (const t of turns) {
    distribution[t] = (distribution[t] ?? 0) + 1;
  }

  return {
    total,
    solvedCount: solved.length,
    failedCount: failed.length,
    solveRate: solved.length / total,
    meanSolved: mean,
    median,
    min,
    max,
    distribution,
    failures: failed.map(r => ({ answer: r.answer, guesses: r.guesses })),
  };
}

/**
 * @typedef {object} SimulationSummary
 * @property {number} total
 * @property {number} solvedCount
 * @property {number} failedCount
 * @property {number} solveRate
 * @property {number} meanSolved - Mean turns across words that were solved (failures excluded).
 * @property {number} median
 * @property {number} min
 * @property {number} max
 * @property {Record<number, number>} distribution
 * @property {{ answer: string, guesses: string[] }[]} failures
 * @property {boolean} [singlePath] - True when a non-deterministic strategy was run via tree sim
 *   (one random path, not a Monte Carlo average). Absent or false for deterministic strategies.
 */

/**
 * Format a summary as a human-readable string.
 */
export function formatSummary(summary, strategyName = 'Strategy') {
  const lines = [
    `=== ${strategyName} ===`,
    `Games: ${summary.total}`,
    `Solved: ${summary.solvedCount}/${summary.total} (${(summary.solveRate * 100).toFixed(1)}%)`,
    `Turns — mean: ${summary.meanSolved.toFixed(2)}, median: ${summary.median}, range: ${summary.min}–${summary.max}`,
    `Distribution:`,
  ];

  const maxTurn = Math.max(...Object.keys(summary.distribution).map(Number));
  for (let t = 1; t <= maxTurn; t++) {
    const count = summary.distribution[t] ?? 0;
    const bar = '█'.repeat(Math.round((count / summary.total) * 60));
    lines.push(`  ${t}: ${String(count).padStart(4)} ${bar}`);
  }

  if (summary.failures.length > 0) {
    lines.push(`Failures (${summary.failedCount}):`);
    for (const f of summary.failures.slice(0, 10)) {
      lines.push(`  ${f.answer}: ${f.guesses.join(' → ')}`);
    }
    if (summary.failures.length > 10) {
      lines.push(`  ... and ${summary.failures.length - 10} more`);
    }
  }

  return lines.join('\n');
}

/**
 * @typedef {object} TreeNode
 * @property {string}   guess        - Word guessed at this node.
 * @property {number}   depth        - Depth in the tree (root = 1).
 * @property {number}   size         - Words remaining when this node is entered.
 * @property {number}   solvedCount  - Words solved directly here (all-green pattern).
 * @property {number}   totalSolved  - Words solved in this subtree (including children).
 * @property {number}   totalTurns   - Sum of solve-depths across all solved words in subtree.
 * @property {number}   meanTurns    - Mean total turns (from root) for words in subtree.
 * @property {number}   maxTurns     - Worst-case total turns for any word in subtree.
 * @property {TreeGroup[]} groups    - Non-green child groups, sorted largest-first.
 */

/**
 * @typedef {object} TreeGroup
 * @property {string}   pattern  - 5-char result string (G/Y/_).
 * @property {number}   size     - Number of words in this group.
 * @property {TreeNode} child    - Subtree for this group.
 */

/**
 * Build a decision tree for a strategy and simultaneously compute simulation
 * statistics. One traversal produces both the tree structure and the summary.
 *
 * @param {import('./strategy.mjs').Strategy} strategy
 * @param {string[]} answers
 * @param {object}  [opts]
 * @param {boolean} [opts.allowNonDeterministic]
 * @param {number}  [opts.maxDepth]
 * @param {(resolved: number, total: number) => void} [opts.onProgress]
 * @returns {{ tree: TreeNode, summary: SimulationSummary }}
 */
export function buildDecisionTree(strategy, answers, opts = {}) {
  if (!strategy.isDeterministic && !opts.allowNonDeterministic) {
    throw new Error(`buildDecisionTree requires a deterministic strategy; ${strategy.name} is not. Pass allowNonDeterministic: true to run anyway (result is a single stochastic path).`);
  }

  const { maxDepth = 32, onProgress } = opts;
  const singlePath   = !strategy.isDeterministic;
  const distribution = {};
  const failures     = [];
  let resolved = 0;

  function buildNode(remaining, depth, guessHistory) {
    const mockGame    = { guesses: guessHistory };
    const guess       = strategy.chooseGuess(mockGame, remaining, remaining);
    const partitions  = partitionByGuess(guess, remaining);
    const nextHistory = [...guessHistory, { word: guess }];

    let solvedCount = 0;
    let totalSolved = 0;
    let totalTurns  = 0;
    let maxTurns    = 0;
    const groups    = [];

    for (const [pattern, group] of partitions) {
      if (pattern === ALL_GREEN_STR) {
        solvedCount  = group.length;
        totalSolved += group.length;
        totalTurns  += depth * group.length;
        maxTurns     = Math.max(maxTurns, depth);
        distribution[depth] = (distribution[depth] ?? 0) + group.length;
        resolved += group.length;
        onProgress?.(resolved + failures.length, answers.length);
      } else if (depth >= maxDepth) {
        for (const w of group) failures.push({ answer: w, guesses: [] });
        onProgress?.(resolved + failures.length, answers.length);
      } else {
        const child  = buildNode(group, depth + 1, nextHistory);
        totalSolved += child.totalSolved;
        totalTurns  += child.totalTurns;
        maxTurns     = Math.max(maxTurns, child.maxTurns);
        groups.push({ pattern, size: group.length, child });
      }
    }

    groups.sort((a, b) => b.size - a.size);

    return {
      guess,
      depth,
      size: remaining.length,
      solvedCount,
      totalSolved,
      totalTurns,
      meanTurns: totalSolved > 0 ? totalTurns / totalSolved : NaN,
      maxTurns,
      groups,
    };
  }

  const tree = buildNode(answers, 1, []);

  const sortedTurns = Object.entries(distribution)
    .flatMap(([t, n]) => Array(n).fill(Number(t)))
    .sort((a, b) => a - b);

  const summary = {
    total:       answers.length,
    solvedCount: resolved,
    failedCount: failures.length,
    solveRate:   resolved / answers.length,
    meanSolved:  resolved > 0 ? tree.totalTurns / resolved : NaN,
    median: sortedTurns[Math.floor(sortedTurns.length / 2)] ?? NaN,
    min:    sortedTurns[0] ?? NaN,
    max:    sortedTurns[sortedTurns.length - 1] ?? NaN,
    distribution,
    failures,
    singlePath,
  };

  return { tree, summary };
}
