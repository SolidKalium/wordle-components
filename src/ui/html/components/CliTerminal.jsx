import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { XtermTerminal, TerminalInterrupt } from '../../cli/XtermTerminal.mjs';
import { GameRunner } from '../../cli/GameRunner.mjs';
import { GradingRunner } from '../../cli/GradingRunner.mjs';
import { BrowserSuggestionWorker } from '../workers/BrowserSuggestionWorker.mjs';
import { ANSWERS, WORDS } from '../../../lib/words.gen.mjs';
import styles from './CliTerminal.module.css';

const OPENING_WORDS = ['crane', 'slate', 'trace', 'raise', 'stare'];

const HELP = `Usage: ./wordle [options]

  -g, --grade      Computer guesses, you grade
  -q, --quickplay  Suggestions shown after each guess
  -e, --explain    Show words remaining / guess ranking
  -w <word>        Use a specific answer word
`;

function parseArgs(argv) {
  let mode    = 'basic';
  let explain = false;
  let answer  = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a.startsWith('--')) {
      if      (a === '--grade')     mode = 'grade';
      else if (a === '--quickplay') mode = 'quickplay';
      else if (a === '--explain')   explain = true;
      else if (a === '--help')      return { help: true };
      else if (a === '--word') {
        if (argv[i + 1]) answer = argv[++i].toLowerCase();
        else return { error: '--word requires an argument' };
      }
      else return { error: `unknown flag: ${a}` };
      continue;
    }

    if (a.startsWith('-') && a.length > 1) {
      // Short flags, possibly combined: -egw word
      const chars = a.slice(1);
      for (let j = 0; j < chars.length; j++) {
        const ch = chars[j];
        if      (ch === 'g') mode = 'grade';
        else if (ch === 'q') mode = 'quickplay';
        else if (ch === 'e') explain = true;
        else if (ch === 'h') return { help: true };
        else if (ch === 'w') {
          if (argv[i + 1]) { answer = argv[++i].toLowerCase(); j = chars.length; }
          else return { error: '-w requires an argument' };
        }
        else return { error: `unknown flag: -${ch}` };
      }
      continue;
    }

    return { error: `unexpected argument: ${a}` };
  }

  return { mode, explain, answer };
}

/**
 * Embeds the CLI game in a browser terminal (xterm.js) with a minimal shell.
 * Type `./wordle` at the prompt to start; Ctrl+C returns to the prompt.
 */
export function CliTerminal({ autoFocus = false }) {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const terminal = new Terminal({
      // scrollback: 0, // This prevents the scrollbar width from messing up the fit add-on, which otherwise creates a feedback loop of shrinking. Ideally, we'd use a different fix and the call to fit would be idempotent.
      // scrollbar: {showScrollbar: false}, // NOTE: this was added after 6.0.0, so it isn't available in a stable release.
      // overviewRuler: {width: 0, showBottomBorder: false, showTopBorder: false}, // NOTE: Available when xterm.js launched 6.0.0. But these aren't working...
      convertEol: true,
      cursorBlink: true,
      fontFamily: '"Cascadia Code", "Fira Code", "Courier New", monospace',
      fontSize: 14,
      theme: { background: '#000000' },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);

    // ResizeObserver re-fits whenever the container gains real dimensions.
    // rAF fires BEFORE ResizeObserver each frame, so a rAF-cleared flag would
    // always be clear by the time the observer fires — useless. Instead the flag
    // is self-resetting: the first callback is an external resize (fit it), the
    // second is the container change caused by fit() itself (clear flag, skip).

    // NOTE: the `fitting` var isn't needed when the fit addon is idempotent. It is idempotent when there's no scrollback. Hopefully a future version makes it idempotent when there is scrollback. When it isn't idempotent, the `fitting` var limits the shrink to once per card open/close cycle.
    // NOTE: the fit add on currently proposes 2 fewer columns than it should when a scrollbar is possible. If you set scrollback: 0 on the terminal, then fitAddon.fit() becomes idempotent and the +2 should be removed.

    // let fitting = false;
    const getFitDetails = function() {
      const wrapperWidth = wrapperRef.current?.clientWidth;
      const terminalWidth = containerRef.current?.clientWidth;
      const proposed = fitAddon.proposeDimensions();
      const current = { cols: terminal.cols, rows: terminal.rows};
      return { wrapperWidth, terminalWidth, proposed, current };
    };
    const ro = new ResizeObserver(() => {
      console.log('fit entered')
      // if (fitting) { fitting = false; return; }
      if (!(containerRef.current?.offsetWidth > 0)) return;
      const proposed = fitAddon.proposeDimensions();
      console.log('before', getFitDetails());
      // if (proposed && proposed.cols === terminal.cols && proposed.rows === terminal.rows) return;
      console.log('fit run')
      // fitting = true;
      // fitAddon.fit();
      terminal.resize(proposed.cols + 2, proposed.rows); // This is needed for the update to be idempotent...
      console.log('after', getFitDetails());
    });
    ro.observe(containerRef.current);

    if (autoFocus) terminal.focus();

    const io        = new XtermTerminal(terminal);
    const suggester = new BrowserSuggestionWorker();
    let running     = true;

    const loop = async () => {
      io.writeLine('Type ./wordle to play  (--help for options, Ctrl+C to quit a game)');

      while (running) {
        let line;
        try {
          line = await io.readShellLine('\r\n$ ');
        } catch (e) {
          if (e instanceof TerminalInterrupt) continue;
          throw e;
        }
        if (!running) break;

        const parts = line.trim().split(/\s+/);
        const cmd   = parts[0];

        if (!cmd) continue;
        if (cmd !== './wordle' && cmd !== 'wordle') {
          io.writeLine(`command not found: ${cmd}`);
          continue;
        }

        const result = parseArgs(parts.slice(1));
        if (result.help)  { io.write(HELP); continue; }
        if (result.error) { io.writeLine(result.error); continue; }

        const { mode, explain, answer } = result;

        if (answer && !WORDS.includes(answer)) {
          io.writeLine(`${answer}: not in word list`);
          continue;
        }

        if (answer && mode === 'quickplay' && !ANSWERS.includes(answer)) {
          io.writeLine(`Quick-play only supports Wordle answer words. The provided word is only in the valid guess list.`);
          continue;
        }

        io.writeLine('');
        const runner = mode === 'grade'
          ? new GradingRunner(io, { wordList: WORDS, answers: ANSWERS, suggester, openingWords: OPENING_WORDS, answer, explain })
          : new GameRunner(io,   { wordList: WORDS, answers: ANSWERS, mode, explain, suggester, answer });

        try {
          await runner.run();
        } catch (e) {
          if (!(e instanceof TerminalInterrupt)) throw e;
        }
      }
    };

    loop().catch(() => {});

    return () => {
      running = false;
      ro.disconnect();
      suggester.terminate();
      terminal.dispose();
    };
  }, []);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <div className={styles.terminal} ref={containerRef} />
    </div>
  );
}
