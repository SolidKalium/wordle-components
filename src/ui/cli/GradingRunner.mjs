import { Game } from '../../lib/game.mjs';
import { GREEN } from '../../lib/core.mjs';

/**
 * Game loop for "computer guesses, human grades" mode.
 *
 * The game runs without a known answer (external mode).  The suggester picks
 * the computer's next guess; the human grades each letter with Up/Down arrows.
 */
export class GradingRunner {
  /**
   * @param {import('./TerminalIO.mjs').TerminalIO} io
   * @param {object} opts
   * @param {string[]} opts.wordList
   * @param {string[]} opts.answers
   * @param {{ compute(remaining: string[], played?: string): Promise<{words: string[]}> }} opts.suggester
   * @param {() => number} [opts.rng=Math.random]
   */
  constructor(io, { wordList, answers, suggester, rng = Math.random }) {
    this.io        = io;
    this.wordList  = wordList;
    this.answers   = answers;
    this.suggester = suggester;
    this.rng       = rng;
  }

  async run() {
    const game = new Game({ wordList: this.wordList }); // external mode — no answer

    this.io.writeLine('Wordle — Grading Mode');
    this.io.writeLine('─────────────────────');
    this.io.writeLine("I'll guess; you grade each letter.");
    this.io.writeLine('Up/Down arrows cycle the colour.  Enter to confirm.');
    this.io.writeLine('');

    while (!game.isOver) {
      const remaining = this.answers.filter(w => game.constraints.matches(w));
      const { words }  = await this.suggester.compute(remaining, null);
      const guess      = words[0];

      if (!guess) {
        this.io.writeLine('No valid guesses remaining — is the grading correct?');
        break;
      }

      const turn   = game.guesses.length + 1;
      const prompt = `Guess ${turn}/${game.maxGuesses}:`;
      const pattern = await this.io.readGradingRaw(prompt, guess, game.constraints);

      // Overwrite the grading row with the final scored result.
      this.io.write('\r' + prompt + ' ');
      this.io.writeGuessResult(guess, pattern);

      game.makeMove(guess, pattern);
    }

    this.io.writeLine('');
    if (game.solved) {
      this.io.writeLine(`Solved in ${game.guesses.length}/${game.maxGuesses}!`);
    } else {
      this.io.writeLine("Couldn't find the word in time.");
    }
  }
}
