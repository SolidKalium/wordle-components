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

  close() {
    this._rl.close();
  }
}
