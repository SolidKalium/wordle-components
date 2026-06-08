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

  useEffect(() => {
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: '"Cascadia Code", "Fira Code", "Courier New", monospace',
      fontSize: 14,
      theme: { background: '#000000' },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();
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
      suggester.terminate();
      terminal.dispose();
    };
  }, []);

  return <div className={styles.terminal} ref={containerRef} />;
}
