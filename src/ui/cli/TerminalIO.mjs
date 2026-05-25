import { GREEN, YELLOW } from '../../lib/core.mjs';

// ANSI escape sequences for Wordle tile colours.
// Each entry covers background + text colour; follow with a letter then RESET.
const ANSI = {
  [GREEN]:  '[42m[1m[97m',   // green bg,      bold bright-white
  [YELLOW]: '[43m[1m[30m',   // yellow bg,     bold black (contrast)
  grey:     '[100m[1m[97m',  // dark-grey bg,  bold bright-white
  reset:    '[0m',
};

/**
 * Abstract base for terminal I/O.
 *
 * Concrete subclasses implement write() and readLine(); everything else is
 * provided here, including ANSI-coloured guess rendering that works on any
 * terminal that understands standard escape sequences (Node TTY, xterm.js).
 */
export class TerminalIO {
  /** Write raw text with no trailing newline. */
  write(_text) {
    throw new Error(`${this.constructor.name}.write() not implemented`);
  }

  /** Write text followed by a newline. */
  writeLine(text = '') {
    this.write(text + '\n');
  }

  /**
   * Prompt the user and return their input as a resolved Promise.
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  readLine(_prompt = '') {
    throw new Error(`${this.constructor.name}.readLine() not implemented`);
  }

  /** Release any held resources (readline interface, listeners, etc.). */
  close() {}

  /**
   * Render one guess row with ANSI tile colours.
   * @param {string}   word     The guessed word.
   * @param {string[]} pattern  Array of GREEN / YELLOW / GREY constants.
   */
  writeGuessResult(word, pattern) {
    const cells = [...word].map((letter, i) => {
      const color = ANSI[pattern[i]] ?? ANSI.grey;
      return `${color} ${letter.toUpperCase()} ${ANSI.reset}`;
    });
    this.writeLine(cells.join(''));
  }
}
