import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { NodeTerminal } from './NodeTerminal.mjs';
import { GameRunner } from './GameRunner.mjs';
import { GradingRunner } from './GradingRunner.mjs';
import { SuggestionWorker } from './SuggestionWorker.mjs';
import { ANSWERS, WORDS } from '../../lib/words.gen.mjs';

const require = createRequire(import.meta.url);
const { version } = require('../../../package.json');

let flags;
try {
  ({ values: flags } = parseArgs({
    options: {
      mode:      { type: 'string',  short: 'm', default: 'basic' },
      quickplay: { type: 'boolean', short: 'q', default: false },
      grade:     { type: 'boolean', short: 'g', default: false },
      explain:   { type: 'boolean', short: 'e', default: false },
      word:      { type: 'string',  short: 'w' },
      help:      { type: 'boolean', short: 'h', default: false },
      version:   { type: 'boolean', short: 'v', default: false },
    },
    strict: true,
  }));
} catch (err) {
  console.error(`${err.message}\nRun with --help for usage.`);
  process.exit(1);
}

if (flags.version) {
  console.log(`wordle-engine v${version}`);
  process.exit(0);
}

if (flags.help) {
  console.log(`Wordle  v${version}

Usage: ./wordle [options]

Options:
  -m, --mode <mode>   Game mode: basic (default), quickplay, or grade
  -q, --quickplay     Shorthand for: --mode quickplay
  -g, --grade         Shorthand for: --mode grade (computer guesses, you grade)
  -e, --explain       Show guess ranking after each move (basic mode only)
  -w, --word <word>   Use a specific word as the answer (any valid guess word)
  -h, --help          Show this help message
  -v, --version       Show version number`);
  process.exit(0);
}

const VALID_MODES = ['basic', 'quickplay', 'grade'];
const mode = flags.quickplay ? 'quickplay' : flags.grade ? 'grade' : flags.mode;
if (!VALID_MODES.includes(mode)) {
  console.error(`Unknown mode: "${mode}". Valid modes: ${VALID_MODES.join(', ')}`);
  process.exit(1);
}

let fixedAnswer = null;
if (flags.word) {
  if (mode === 'grade') {
    console.error('--word is not used in grade mode (the computer chooses its own guesses).');
    process.exit(1);
  }
  fixedAnswer = flags.word.toLowerCase();
  if (!WORDS.includes(fixedAnswer)) {
    console.error(`"${flags.word}" is not a valid word.`);
    process.exit(1);
  }
}

const io = new NodeTerminal();
const suggester = new SuggestionWorker();

let runner;
if (mode === 'grade') {
  const openingWords = ['crane', 'slate', 'trace', 'raise', 'stare'];
  runner = new GradingRunner(io, { wordList: WORDS, answers: ANSWERS, suggester, openingWords });
} else {
  runner = new GameRunner(io, {
    wordList: WORDS,
    answers: ANSWERS,
    mode,
    explain: flags.explain,
    suggester,
    answer: fixedAnswer,
  });
}

try {
  await runner.run();
} finally {
  io.close();
  await suggester.terminate();
}
