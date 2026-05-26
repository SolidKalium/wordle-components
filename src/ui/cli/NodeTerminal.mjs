import { createInterface } from 'node:readline';
import { TerminalIO } from './TerminalIO.mjs';

/**
 * TerminalIO adapter for Node.js process stdio.
 *
 * Uses readline for line-buffered input so the user sees their characters
 * echoed and can use backspace before pressing Enter.
 */
export class NodeTerminal extends TerminalIO {
  constructor() {
    super();
    this._rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    // Prevent readline from keeping the process alive on its own.
    this._rl.on('close', () => {});
  }

  write(text) {
    process.stdout.write(text);
  }

  readLine(prompt = '') {
    return new Promise(resolve => {
      this._rl.question(prompt, answer => resolve(answer));
    });
  }

  /**
   * Enter raw mode and read one complete 5-letter word from the player.
   *
   * Renders `prompt + tile row` on every keystroke using constraint-aware
   * colouring.  Number keys 1–6 load the corresponding suggestion into the
   * buffer without submitting.  Falls back to readLine on non-TTY stdin.
   *
   * Caller is responsible for finalising the line after this resolves
   * (e.g. overwriting with the graded result via \r).
   *
   * @param {string}   prompt       e.g. "Guess 1/6:"
   * @param {import('../../lib/constraints.mjs').ConstraintState} constraints
   * @param {string[]} [suggestions=[]]  Words mapped to number keys 1–6.
   * @returns {Promise<string>}  Submitted word, 5 chars, lowercase.
   */
  async readWordRaw(prompt, constraints, suggestions = []) {
    if (!process.stdin.isTTY) {
      return (await this.readLine(prompt + ' ')).trim().toLowerCase();
    }

    // Hand stdin over from readline to our raw data loop.
    this._rl.close();
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();

    return new Promise(resolve => {
      let buffer = '';

      const cleanup = () => {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        this._rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        this._rl.on('close', () => {});
      };

      const onData = (rawKey) => {
        const { buffer: next, done, exit } = this._handleWordKey(rawKey, buffer, suggestions);
        buffer = next;

        if (exit) { cleanup(); process.stdout.write('\n'); process.exit(0); }
        if (done) { cleanup(); resolve(buffer); return; }
        this._renderPendingLine(prompt, buffer, constraints);
      };

      process.stdin.on('data', onData);
      this._renderPendingLine(prompt, buffer, constraints);
    });
  }

  close() {
    this._rl.close();
  }
}
