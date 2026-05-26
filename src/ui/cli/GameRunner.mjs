import { Game, MoveResult } from '../../lib/game.mjs';

const ERROR_MESSAGES = {
  [MoveResult.WRONG_LENGTH]:       'Word must be 5 letters.',
  [MoveResult.NOT_IN_LIST]:        'Not in word list.',
  [MoveResult.HARD_MODE_KNOWN]:    null, // use detail
  [MoveResult.HARD_MODE_REQUIRED]: null,
};

/**
 * Game loop for "computer picks a word, player guesses".
 *
 * Designed to work with any TerminalIO implementation (NodeTerminal,
 * XtermTerminal, or a test double).
 *
 * TODO: expose mode and explain as CLI flags / config options.
 */
export class GameRunner {
  /**
   * @param {import('./TerminalIO.mjs').TerminalIO} io
   * @param {object}   opts
   * @param {string[]} opts.wordList    All valid guesses.
   * @param {string[]} opts.answers     Pool of possible answers.
   * @param {'basic'|'quickplay'} [opts.mode='basic']
   *   'basic'     — player types their own guesses; no suggestions shown.
   *   'quickplay' — suggestions shown after each scored guess.
   * @param {boolean}  [opts.explain=false]
   *   Show post-guess explanation (remaining count, rank, best word).
   *   Active in 'basic' mode. Quick-play explanation requires raw mode (deferred).
   * @param {{ compute(remaining: string[], played?: string): Promise<object> }} [opts.suggester]
   *   Worker client. Required for quickplay mode and basic+explain.
   * @param {() => number} [opts.rng=Math.random]
   */
  constructor(io, {
    wordList,
    answers,
    mode = 'basic',
    explain = false,
    suggester = null,
    rng = Math.random,
  } = {}) {
    this.io = io;
    this.wordList = wordList;
    this.answers = answers;
    this.mode = mode;
    this.explain = explain;
    this.suggester = suggester;
    this.rng = rng;
    this._currentSuggestions = [];
  }

  async run() {
    const answer = this.answers[Math.floor(this.rng() * this.answers.length)];
    const game = new Game({ answer, wordList: this.wordList });
    const useRaw = typeof this.io.readWordRaw === 'function' && !!process.stdin?.isTTY;

    this.io.writeLine('Wordle');
    this.io.writeLine('──────');
    this.io.writeLine('Guess a 5-letter word. Type and press Enter.');
    this.io.writeLine('');

    while (!game.isOver) {
      // Snapshot remaining before the guess (needed for basic+explain ranking).
      const remainingBefore = (this.mode === 'basic' && this.explain && this.suggester)
        ? this.answers.filter(w => game.constraints.matches(w))
        : null;

      const turn = game.guesses.length + 1;
      const prompt = `Guess ${turn}/${game.maxGuesses}:`;
      const guess = useRaw
        ? await this.io.readWordRaw(prompt, game.constraints, this._currentSuggestions)
        : (await this.io.readLine(prompt + ' ')).trim().toLowerCase();

      if (!guess) continue;

      const result = game.makeMove(guess);

      if (!result.valid) {
        const msg = ERROR_MESSAGES[result.error] ?? result.detail ?? `Invalid (${result.error})`;
        if (useRaw) this.io.writeLine(''); // leave the invalid attempt visible
        this.io.writeLine(msg);
        continue;
      }

      if (useRaw) this.io.write('\r' + prompt + ' ');
      this.io.writeGuessResult(guess, result.pattern);

      if (!game.isOver && this.suggester) {
        const remainingAfter = this.answers.filter(w => game.constraints.matches(w));

        if (this.mode === 'quickplay') {
          const { words } = await this.suggester.compute(remainingAfter, null);
          this._currentSuggestions = words;
          if (words.length) this._writeSuggestions(words);
        } else if (this.mode === 'basic' && this.explain) {
          const info = await this.suggester.compute(remainingBefore, guess);
          this._writeExplanation(guess, info, remainingAfter.length);
        }
      }
    }

    this.io.writeLine('');
    if (game.solved) {
      this.io.writeLine(`Solved in ${game.guesses.length}/${game.maxGuesses}!`);
    } else {
      this.io.writeLine(`Game over. The word was ${game.answer.toUpperCase()}.`);
    }
  }

  _writeSuggestions(words) {
    const DIM = '[2m';
    const RESET = '[0m';
    const formatted = words.map((w, i) => `${DIM}${i + 1}.${RESET}${w}`).join('  ');
    this.io.writeLine(`  ${formatted}`);
  }

  _writeExplanation(guess, { rank, percentile, bestWord, total, outsidePool }, wordsLeft) {
    const plural = wordsLeft === 1 ? 'word remains' : 'words remain';
    let line = `${wordsLeft} ${plural}.`;

    if (rank != null) {
      const topPct = Math.max(1, Math.round((rank / total) * 100));
      const scope = outsidePool ? ' among possible answers' : '';
      line += ` ${guess} ranked ${rank}/${total}${scope} (top ${topPct}%).`;
      if (bestWord && bestWord !== guess && wordsLeft > 5) line += ` Best: ${bestWord}.`;
    }

    this.io.writeLine(`  ${line}`);
  }
}
