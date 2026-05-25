import { Game, MoveResult } from '../../lib/game.mjs';

const ERROR_MESSAGES = {
  [MoveResult.WRONG_LENGTH]:      'Word must be 5 letters.',
  [MoveResult.NOT_IN_LIST]:       'Not in word list.',
  [MoveResult.HARD_MODE_KNOWN]:   null, // use detail
  [MoveResult.HARD_MODE_REQUIRED]: null,
};

/**
 * Game loop for "computer picks a word, player guesses".
 *
 * Designed to work with any TerminalIO implementation (NodeTerminal,
 * XtermTerminal, or a test double).
 */
export class GameRunner {
  /**
   * @param {import('./TerminalIO.mjs').TerminalIO} io
   * @param {object}   opts
   * @param {string[]} opts.wordList   All valid guesses.
   * @param {string[]} opts.answers    Pool of possible answers.
   * @param {{ suggest(remaining: string[]): Promise<string[]> }} [opts.suggester]
   *   Optional worker client. When provided, shows suggestions after each scored guess.
   * @param {() => number} [opts.rng=Math.random]
   */
  constructor(io, { wordList, answers, suggester = null, rng = Math.random } = {}) {
    this.io = io;
    this.wordList = wordList;
    this.answers = answers;
    this.suggester = suggester;
    this.rng = rng;
  }

  async run() {
    const answer = this.answers[Math.floor(this.rng() * this.answers.length)];
    const game = new Game({ answer, wordList: this.wordList });

    this.io.writeLine('Wordle');
    this.io.writeLine('──────');
    this.io.writeLine('Guess a 5-letter word. Type and press Enter.');
    this.io.writeLine('');

    while (!game.isOver) {
      const turn = game.guesses.length + 1;
      const raw = await this.io.readLine(`Guess ${turn}/${game.maxGuesses}: `);
      const guess = raw.trim().toLowerCase();

      if (!guess) continue;

      const result = game.makeMove(guess);

      if (!result.valid) {
        const msg = ERROR_MESSAGES[result.error] ?? result.detail ?? `Invalid (${result.error})`;
        this.io.writeLine(msg);
        continue;
      }

      this.io.writeGuessResult(guess, result.pattern);

      if (!game.isOver && this.suggester) {
        const remaining = this.answers.filter(w => game.constraints.matches(w));
        const words = await this.suggester.suggest(remaining);
        if (words.length) this._writeSuggestions(words);
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
    const formatted = words.map((w, i) => `${i + 1}.${w}`).join('  ');
    this.io.writeLine(`  ${formatted}`);
  }
}
