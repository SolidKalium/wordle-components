import { NodeTerminal } from './NodeTerminal.mjs';
import { GameRunner } from './GameRunner.mjs';
import { SuggestionWorker } from './SuggestionWorker.mjs';
import { ANSWERS, WORDS } from '../../lib/words.gen.mjs';

const io = new NodeTerminal();
const suggester = new SuggestionWorker();
const runner = new GameRunner(io, { wordList: WORDS, answers: ANSWERS, mode: 'basic', explain: true, suggester });

try {
  await runner.run();
} finally {
  io.close();
  await suggester.terminate();
}
