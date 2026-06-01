import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { XtermTerminal } from '../../cli/XtermTerminal.mjs';
import { GameRunner } from '../../cli/GameRunner.mjs';
import { GradingRunner } from '../../cli/GradingRunner.mjs';
import { BrowserSuggestionWorker } from '../BrowserSuggestionWorker.mjs';
import { ANSWERS, WORDS } from '../../../lib/words.gen.mjs';
import styles from './CliTerminal.module.css';

const OPENING_WORDS = ['crane', 'slate', 'trace', 'raise', 'stare'];

/**
 * Embeds the CLI game in a browser terminal (xterm.js).
 *
 * @param {{ mode?: 'basic'|'quickplay'|'grade', answer?: string|null, explain?: boolean }} props
 */
export function CliTerminal({ mode = 'basic', answer = null, explain = false }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: '"Cascadia Code", "Fira Code", "Courier New", monospace',
      fontSize: 14,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    const io       = new XtermTerminal(terminal);
    const suggester = new BrowserSuggestionWorker();
    let running    = true;

    const loop = async () => {
      while (running) {
        const runner = mode === 'grade'
          ? new GradingRunner(io, { wordList: WORDS, answers: ANSWERS, suggester, openingWords: OPENING_WORDS, answer, explain })
          : new GameRunner(io,   { wordList: WORDS, answers: ANSWERS, mode, explain, suggester });

        await runner.run();
        if (!running) break;

        await io.readLine('\nPress Enter to play again...');
        if (!running) break;
        terminal.clear();
      }
    };

    loop().catch(() => {});

    return () => {
      running = false;
      suggester.terminate();
      terminal.dispose();
    };
  }, [mode, answer, explain]);

  return <div className={styles.terminal} ref={containerRef} />;
}
