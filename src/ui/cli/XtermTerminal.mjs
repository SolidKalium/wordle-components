import { TerminalIO } from './TerminalIO.mjs';

/**
 * TerminalIO adapter for an xterm.js Terminal instance.
 *
 * Accepts an already-constructed Terminal (from the 'xterm' package) so that
 * the React component that owns the Terminal's lifecycle passes it in here.
 * No direct import of 'xterm' is needed — duck-typing keeps this module
 * browser-safe regardless of whether xterm is installed.
 *
 * @param {import('xterm').Terminal} terminal
 */
export class XtermTerminal extends TerminalIO {
  constructor(terminal) {
    super();
    this._terminal = terminal;
    this._lineBuffer = '';
    this._lineResolve = null;

    // xterm.js fires onData for every character the user types.
    this._terminal.onData(data => this._handleData(data));
  }

  write(text) {
    // xterm.js expects \r\n for newlines; normalise bare \n.
    this._terminal.write(text.replace(/\n/g, '\r\n'));
  }

  readLine(prompt = '') {
    if (prompt) this._terminal.write(prompt);
    return new Promise(resolve => {
      this._lineBuffer = '';
      this._lineResolve = resolve;
    });
  }

  close() {
    // Terminal lifecycle is managed externally by the React component.
  }

  _handleData(data) {
    if (!this._lineResolve) return;

    if (data === '\r' || data === '\n') {
      const resolve = this._lineResolve;
      const line = this._lineBuffer;
      this._lineResolve = null;
      this._lineBuffer = '';
      this._terminal.write('\r\n');
      resolve(line);
    } else if (data === '' || data === '\b') {
      // Backspace: erase last character from buffer and from screen.
      if (this._lineBuffer.length > 0) {
        this._lineBuffer = this._lineBuffer.slice(0, -1);
        this._terminal.write('\b \b');
      }
    } else if (data >= ' ') {
      this._lineBuffer += data;
      this._terminal.write(data); // echo
    }
  }
}
