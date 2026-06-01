import { GREEN, YELLOW, GREY } from '../../lib/core.mjs';
import { TerminalIO } from './TerminalIO.mjs';

/**
 * Thrown when the user presses Ctrl+C inside any XtermTerminal read method.
 * Callers can catch this to return to a shell prompt rather than exiting.
 */
export class TerminalInterrupt extends Error {
  constructor() {
    super('Terminal interrupt');
    this.name = 'TerminalInterrupt';
  }
}

/**
 * TerminalIO adapter for an xterm.js Terminal instance.
 */
export class XtermTerminal extends TerminalIO {
  constructor(terminal) {
    super();
    this._terminal = terminal;
    this._lineBuffer = '';
    this._lineResolve = null;
    this._lineReject  = null;
    this._rawModeHandler = null;
    this._shellHistory = []; // persists across readShellLine calls

    this._terminal.onData(data => this._handleData(data));
  }

  write(text) {
    this._terminal.write(text.replace(/\n/g, '\r\n'));
  }

  readLine(prompt = '') {
    if (prompt) this._terminal.write(prompt);
    return new Promise((resolve, reject) => {
      this._lineBuffer = '';
      this._lineResolve = resolve;
      this._lineReject  = reject;
    });
  }

  /**
   * Raw-mode line reader for the shell prompt.
   *
   * Supports: printable characters, backspace (\x7f / \b), left/right cursor
   * movement, up/down history navigation.  Throws TerminalInterrupt on Ctrl+C.
   *
   * @param {string} prompt  Written once on entry; only the visible portion
   *   after the last newline is used when re-rendering the line in-place.
   */
  readShellLine(prompt = '') {
    this._terminal.write(prompt);
    // For in-place re-renders we only need the part that sits on the current line.
    const displayPrompt = prompt.split('\n').pop().replace(/\r/g, '');

    return new Promise((resolve, reject) => {
      let buffer  = [];
      let cursor  = 0;
      let histIdx = -1;  // -1 = current (unsaved) input
      let saved   = '';  // current input saved while browsing history

      const render = () => {
        const trailing = buffer.length - cursor;
        this._terminal.write('\r' + displayPrompt + buffer.join('') + '\x1b[K');
        if (trailing > 0) this._terminal.write(`\x1b[${trailing}D`);
      };

      this._rawModeHandler = (data) => {
        if (data === '\x03') { // Ctrl+C
          this._rawModeHandler = null;
          this.write('^C\r\n');
          reject(new TerminalInterrupt());
          return;
        }

        if (data === '\r' || data === '\n') {
          this._rawModeHandler = null;
          this._terminal.write('\r\n');
          const line = buffer.join('');
          if (line) this._shellHistory.push(line);
          resolve(line);
          return;
        }

        if (data === '\x7f' || data === '\b') { // backspace
          if (cursor > 0) { buffer.splice(cursor - 1, 1); cursor--; render(); }
          return;
        }

        if (data === '\x1b[D') { // left arrow
          if (cursor > 0) { cursor--; this._terminal.write('\x1b[D'); }
          return;
        }

        if (data === '\x1b[C') { // right arrow
          if (cursor < buffer.length) { cursor++; this._terminal.write('\x1b[C'); }
          return;
        }

        if (data === '\x1b[A') { // up arrow — older history
          if (!this._shellHistory.length) return;
          if (histIdx === -1) saved = buffer.join('');
          histIdx = Math.min(histIdx + 1, this._shellHistory.length - 1);
          buffer = [...this._shellHistory[this._shellHistory.length - 1 - histIdx]];
          cursor = buffer.length;
          render();
          return;
        }

        if (data === '\x1b[B') { // down arrow — newer history / back to current
          if (histIdx === -1) return;
          histIdx--;
          buffer = histIdx === -1
            ? [...saved]
            : [...this._shellHistory[this._shellHistory.length - 1 - histIdx]];
          cursor = buffer.length;
          render();
          return;
        }

        if (data.startsWith('\x1b')) return; // ignore other escape sequences

        if (data >= ' ') {
          // Handles single characters and pasted multi-character sequences.
          for (const ch of data) { buffer.splice(cursor++, 0, ch); }
          render();
        }
      };
    });
  }

  async readGradingRaw(prompt, word, constraints, remainingCount = null) {
    return new Promise((resolve, reject) => {
      let slots           = this._computeGradingSlots(word, constraints);
      let cursor          = slots.findIndex(s => !s.fixed);
      let error           = null;
      let errorPressCount = 0;

      if (cursor === -1) {
        resolve(slots.map(s => s.state));
        return;
      }

      this.write('\x1b[?25l');
      this._renderGradingBlock(prompt, slots, cursor, error, remainingCount, true);

      this._rawModeHandler = (rawKey) => {
        const result = this._handleGradingKey(rawKey, slots, cursor, constraints, errorPressCount);
        slots           = result.slots;
        cursor          = result.cursor;
        error           = result.error;
        errorPressCount = result.errorPressCount;
        if (result.done || result.exit || result.undo) {
          this._rawModeHandler = null;
          this.write('\x1b[?25h');
          if (result.exit) {
            this.write('^C\r\n');
            reject(new TerminalInterrupt());
          } else if (result.undo || result.done) {
            this.write('\x1b[2A\r\x1b[J');
            resolve(result.done ? slots.map(s => s.state) : null);
          }
        } else {
          this._renderGradingBlock(prompt, slots, cursor, error, remainingCount, false);
        }
      };
    });
  }

  close() {}

  async readUndoOrQuit(message) {
    this.writeLine(message);
    return new Promise(resolve => {
      this._rawModeHandler = (key) => {
        if (key === '\x1a') { this._rawModeHandler = null; resolve('undo'); }
        else if (key === '\r' || key === '\n' || key === '\x03') { this._rawModeHandler = null; resolve('quit'); }
      };
    });
  }

  async readWordRaw(prompt, constraints, suggestions = []) {
    return new Promise((resolve, reject) => {
      let buffer = [null, null, null, null, null];
      let cursor = 0;
      this.write('\x1b[?25l');
      this._renderPendingLine(prompt, buffer, constraints, cursor);

      this._rawModeHandler = (rawKey) => {
        const { buffer: next, cursor: nextCursor, done, exit } =
          this._handleWordKey(rawKey, buffer, cursor, suggestions, constraints);
        buffer = next;
        cursor = nextCursor;
        if (done || exit) {
          this._rawModeHandler = null;
          this.write('\x1b[?25h');
          if (exit) {
            this.write('^C\r\n');
            reject(new TerminalInterrupt());
          } else if (done) {
            resolve(buffer.join(''));
          }
        } else {
          this._renderPendingLine(prompt, buffer, constraints, cursor);
        }
      };
    });
  }

  _handleData(data) {
    if (this._rawModeHandler) { this._rawModeHandler(data); return; }

    if (data === '\x03') {
      const reject = this._lineReject;
      this._lineResolve = null;
      this._lineReject  = null;
      this._lineBuffer  = '';
      this.write('^C\r\n');
      if (reject) reject(new TerminalInterrupt());
      return;
    }

    if (!this._lineResolve) return;

    if (data === '\r' || data === '\n') {
      const resolve = this._lineResolve;
      const line = this._lineBuffer;
      this._lineResolve = null;
      this._lineReject  = null;
      this._lineBuffer  = '';
      this._terminal.write('\r\n');
      resolve(line);
    } else if (data === '\x7f' || data === '\b') {
      if (this._lineBuffer.length > 0) {
        this._lineBuffer = this._lineBuffer.slice(0, -1);
        this._terminal.write('\b \b');
      }
    } else if (data >= ' ') {
      this._lineBuffer += data;
      this._terminal.write(data);
    }
  }
}
