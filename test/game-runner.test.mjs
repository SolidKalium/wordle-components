import { describe, it, expect } from 'vitest';
import { TerminalIO } from '../src/ui/cli/TerminalIO.mjs';
import { GameRunner } from '../src/ui/cli/GameRunner.mjs';
import { TEST_WORDS } from '../src/lib/wordlist.mjs';

// Test double: captures output, replays pre-set inputs in order.
class MemoryTerminal extends TerminalIO {
  constructor(...inputs) {
    super();
    this.output = '';
    this._inputs = inputs;
  }
  write(text) { this.output += text; }
  readLine(prompt = '') {
    this.write(prompt);
    return Promise.resolve(this._inputs.shift() ?? '');
  }
}

// Always picks the first answer.
const firstRng = () => 0;

// Mock suggester using the compute() interface.
const mockSuggester = {
  compute: (remaining, played) => Promise.resolve({
    words: ['about', 'black', 'draft'],
    total: remaining.length,
    rank:      played ? 3 : undefined,
    percentile: played ? 0.06 : undefined,
    bestWord:   played ? 'about' : undefined,
  }),
};

function makeRunner(io, answers = ['crane'], wordList = TEST_WORDS, opts = {}) {
  return new GameRunner(io, { wordList, answers, rng: firstRng, ...opts });
}

describe('GameRunner — win', () => {
  it('reports solved with the correct turn count', async () => {
    const t = new MemoryTerminal('slate', 'crane');
    await makeRunner(t).run();
    expect(t.output).toContain('Solved in 2/6');
  });

  it('output contains colored results for each valid guess', async () => {
    const t = new MemoryTerminal('crane');
    await makeRunner(t).run();
    expect(t.output).toContain('C');
    expect(t.output).toContain('R');
    expect(t.output).toContain('A');
    expect(t.output).toContain('N');
    expect(t.output).toContain('E');
  });
});

describe('GameRunner — loss', () => {
  it('reveals the answer when guesses are exhausted', async () => {
    const wrong = ['about', 'black', 'draft', 'feast', 'ghost', 'house'];
    const t = new MemoryTerminal(...wrong);
    await makeRunner(t).run();
    expect(t.output).toContain('CRANE');
    expect(t.output).toContain('Game over');
  });
});

describe('GameRunner — invalid input', () => {
  it('skips empty input without counting a turn', async () => {
    const t = new MemoryTerminal('', '', 'crane');
    await makeRunner(t).run();
    expect(t.output).toContain('Solved in 1/6');
  });

  it('shows an error and re-prompts on a word not in the list', async () => {
    const t = new MemoryTerminal('zzzzz', 'crane');
    await makeRunner(t).run();
    expect(t.output).toContain('Not in word list');
    expect(t.output).toContain('Solved in 1/6');
  });

  it('shows an error and re-prompts on wrong word length', async () => {
    const t = new MemoryTerminal('hi', 'crane');
    await makeRunner(t).run();
    expect(t.output).toContain('5 letters');
    expect(t.output).toContain('Solved in 1/6');
  });
});

describe('GameRunner — output structure', () => {
  it('shows a header', async () => {
    const t = new MemoryTerminal('crane');
    await makeRunner(t).run();
    expect(t.output).toContain('Wordle');
  });

  it('prompts with the current turn number', async () => {
    const t = new MemoryTerminal('slate', 'crane');
    await makeRunner(t).run();
    expect(t.output).toContain('Guess 1/6');
    expect(t.output).toContain('Guess 2/6');
  });
});

describe('GameRunner — quickplay suggestions', () => {
  it('shows suggestions after a valid guess', async () => {
    const t = new MemoryTerminal('slate', 'crane');
    await makeRunner(t, ['crane'], TEST_WORDS, { mode: 'quickplay', suggester: mockSuggester }).run();
    expect(t.output).toContain('about');
    expect(t.output).toContain('black');
    expect(t.output).toContain('draft');
  });

  it('numbers the suggestions starting at 1', async () => {
    const t = new MemoryTerminal('slate', 'crane');
    await makeRunner(t, ['crane'], TEST_WORDS, { mode: 'quickplay', suggester: mockSuggester }).run();
    expect(t.output).toMatch(/1\..+about/);
  });

  it('does not show suggestions after the winning guess', async () => {
    const t = new MemoryTerminal('crane');
    await makeRunner(t, ['crane'], TEST_WORDS, { mode: 'quickplay', suggester: mockSuggester }).run();
    expect(t.output).not.toContain('about');
  });

  it('does not show suggestions when no suggester is provided', async () => {
    const t = new MemoryTerminal('slate', 'crane');
    await makeRunner(t).run();
    expect(t.output).not.toContain('1.');
  });
});

describe('GameRunner — basic explanation', () => {
  it('shows remaining word count after a guess', async () => {
    const t = new MemoryTerminal('slate', 'crane');
    await makeRunner(t, ['crane'], TEST_WORDS, { mode: 'basic', explain: true, suggester: mockSuggester }).run();
    expect(t.output).toMatch(/\d+ words? remain/);
  });

  it('shows the rank of the played word', async () => {
    const t = new MemoryTerminal('slate', 'crane');
    await makeRunner(t, ['crane'], TEST_WORDS, { mode: 'basic', explain: true, suggester: mockSuggester }).run();
    expect(t.output).toContain('slate ranked 3/');
  });

  it('shows the best word when it differs from the guess and many words remain', async () => {
    // All share a@pos2, e@pos4, no s/l/t — all survive 'slate' vs 'crane' constraints.
    const manyAnswers = ['crane', 'grape', 'grace', 'frame', 'grade', 'brave', 'drape', 'crave'];
    const t = new MemoryTerminal('slate', 'crane');
    await makeRunner(t, manyAnswers, TEST_WORDS, { mode: 'basic', explain: true, suggester: mockSuggester }).run();
    expect(t.output).toContain('Best: about');
  });

  it('hides the best word when 5 or fewer words remain', async () => {
    const t = new MemoryTerminal('slate', 'crane');
    await makeRunner(t, ['crane'], TEST_WORDS, { mode: 'basic', explain: true, suggester: mockSuggester }).run();
    expect(t.output).not.toContain('Best:');
  });

  it('omits Best line when the played word is the best word', async () => {
    const bestSuggester = {
      compute: (remaining, played) => Promise.resolve({
        words: [], total: remaining.length,
        rank: 1, percentile: 0, bestWord: played,
      }),
    };
    const manyAnswers = ['crane', 'grape', 'grace', 'frame', 'grade', 'brave', 'drape', 'crave'];
    const t = new MemoryTerminal('slate', 'crane');
    await makeRunner(t, manyAnswers, TEST_WORDS, { mode: 'basic', explain: true, suggester: bestSuggester }).run();
    expect(t.output).not.toContain('Best:');
  });

  it('does not show explanation after the winning guess', async () => {
    const t = new MemoryTerminal('crane');
    await makeRunner(t, ['crane'], TEST_WORDS, { mode: 'basic', explain: true, suggester: mockSuggester }).run();
    expect(t.output).not.toMatch(/\d+ words? remain/);
  });

  it('does not show explanation when explain is false', async () => {
    const t = new MemoryTerminal('slate', 'crane');
    await makeRunner(t, ['crane'], TEST_WORDS, { mode: 'basic', explain: false, suggester: mockSuggester }).run();
    expect(t.output).not.toMatch(/ranked/);
  });

  it('notes "among possible answers" when played word is outside the answer pool', async () => {
    const outsideSuggester = {
      compute: (remaining, played) => Promise.resolve({
        words: ['about', 'black', 'draft'],
        total: remaining.length + 1,
        rank: 5, percentile: 5 / (remaining.length + 1),
        bestWord: 'about', outsidePool: true,
      }),
    };
    const t = new MemoryTerminal('slate', 'crane');
    await makeRunner(t, ['crane'], TEST_WORDS, { mode: 'basic', explain: true, suggester: outsideSuggester }).run();
    expect(t.output).toContain('among possible answers');
  });
});
