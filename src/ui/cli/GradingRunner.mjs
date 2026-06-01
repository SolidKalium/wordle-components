import { Game } from '../../lib/game.mjs';

/**
 * Game loop for "computer guesses, human grades" mode.
 *
 * Without an answer the game runs in external mode — the human grades each
 * letter interactively.  With an answer the game grades itself automatically
 * (auto-play), useful for testing strategies against a known word.
 */
export class GradingRunner {
  /**
   * @param {import('./TerminalIO.mjs').TerminalIO} io
   * @param {object} opts
   * @param {string[]} opts.wordList
   * @param {string[]} opts.answers
   * @param {{ compute(remaining: string[], played?: string): Promise<{words: string[]}> }} opts.suggester
   * @param {string[]} [opts.openingWords]  Pool of first-guess words to pick from randomly.
   *   When provided, the suggester is skipped on turn 1 (avoiding a full-list computation).
   * @param {string|null} [opts.answer]  Known answer for auto-play; null for interactive grading.
   * @param {boolean} [opts.explain]  Append "N words possible" to each committed result line.
   * @param {() => number} [opts.rng=Math.random]
   */
  constructor(io, { wordList, answers, suggester, openingWords = null, answer = null, explain = false, rng = Math.random }) {
    this.io           = io;
    this.wordList     = wordList;
    this.answers      = answers;
    this.suggester    = suggester;
    this.openingWords = openingWords;
    this.answer       = answer;
    this.explain      = explain;
    this.rng          = rng;
  }

  async run() {
    const game = this.answer
      ? new Game({ wordList: this.wordList, answer: this.answer })
      : new Game({ wordList: this.wordList }); // external mode — no answer

    this.io.writeLine('Wordle — Grading Mode');
    this.io.writeLine('─────────────────────');
    if (this.answer) {
      this.io.writeLine("I'll guess; the word grades itself.");
    } else {
      this.io.writeLine("I'll guess; you grade each letter.");
      this.io.writeLine('Up/Down or W/S cycle the colour.  Left/Right or A/D move cursor.  Enter to confirm.  Ctrl-Z to undo.');
    }
    this.io.writeLine('');

    // warningLinesPerMove[i] = warning lines printed before game.guesses[i] was committed.
    // Used by undo to know how far up to erase.
    const warningLinesPerMove = [];
    let pendingGuess         = null; // set after undo to re-present the same word
    let shownFallbackWarning = false; // suppress repeat fallback notices within one stretch

    while (!game.isOver) {
      let warningLines = 0;

      // Determine candidate pool, falling back to the full word list once if
      // no answer is consistent with the current constraints.
      let remaining = this.answers.filter(w => game.constraints.matches(w));
      if (remaining.length === 0) {
        if (!shownFallbackWarning) {
          this.io.writeLine("Your word isn't in the Wordle answer list; falling back to valid guesses.");
          warningLines++;
          shownFallbackWarning = true;
        }
        remaining = this.wordList.filter(w => game.constraints.matches(w));
      } else {
        shownFallbackWarning = false; // back in normal territory
      }

      // Full exhaustion — nothing left in either list.
      if (remaining.length === 0) {
        if (this.answer) {
          this.io.writeLine("No valid words remain — strategy failed.");
          break;
        }
        const action = await this.io.readUndoOrQuit(
          "No valid words remain. Press Ctrl+Z to undo the last guess, or Enter to quit."
        );
        warningLines++;
        if (action === 'undo') {
          const undone = game.undoMove();
          if (undone) {
            const prevWarningLines = warningLinesPerMove.pop() ?? 0;
            this.io.write(`\x1b[${warningLines + 1 + prevWarningLines}A\r\x1b[J`);
            pendingGuess = undone.word;
            shownFallbackWarning = false;
          }
        } else {
          break; // quit
        }
        continue;
      }

      let guess;
      if (pendingGuess !== null) {
        guess = pendingGuess;
        pendingGuess = null;
      } else if (game.guesses.length === 0 && this.openingWords?.length) {
        guess = this.openingWords[Math.floor(this.rng() * this.openingWords.length)];
      } else {
        const { words } = await this.suggester.compute(remaining, null);
        guess = words[0];
      }

      if (!guess) break; // suggester returned nothing (shouldn't happen given the above)

      const turn   = game.guesses.length + 1;
      const prompt = `Guess ${turn}/${game.maxGuesses}:`;
      const suffix = this.explain
        ? `     ${remaining.length} ${remaining.length === 1 ? 'word' : 'words'} possible`
        : '';

      if (this.answer) {
        // Auto-play: game scores the guess itself.
        game.makeMove(guess);
        const { pattern } = game.guesses.at(-1);
        this.io.write(prompt + ' ');
        this.io.writeGuessResult(guess, pattern, suffix);
      } else {
        // Interactive grading.
        const pattern = await this.io.readGradingRaw(prompt, guess, game.constraints, remaining.length);

        if (pattern === null) {
          // Undo: erase current iteration's warnings + committed result + that result's preceding warnings.
          const undone = game.undoMove();
          if (undone) {
            const prevWarningLines = warningLinesPerMove.pop() ?? 0;
            this.io.write(`\x1b[${warningLines + 1 + prevWarningLines}A\r\x1b[J`);
            pendingGuess = undone.word;
            shownFallbackWarning = false;
          } else {
            pendingGuess = guess; // nothing to undo — re-present the same word
          }
          continue;
        }

        // Overwrite the grading block with the final scored result.
        this.io.write('\r' + prompt + ' ');
        this.io.writeGuessResult(guess, pattern, suffix);

        game.makeMove(guess, pattern);
        warningLinesPerMove.push(warningLines);
      }
    }

    this.io.writeLine('');
    if (game.solved) {
      this.io.writeLine(`Solved in ${game.guesses.length}/${game.maxGuesses}!`);
    } else {
      this.io.writeLine("Couldn't find the word in time.");
    }
  }
}
