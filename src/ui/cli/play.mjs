import { NodeTerminal } from './NodeTerminal.mjs';
import { GameRunner } from './GameRunner.mjs';
import { ANSWERS, WORDS } from '../../lib/words.gen.mjs';

const io = new NodeTerminal();
const runner = new GameRunner(io, { wordList: WORDS, answers: ANSWERS });

try {
  await runner.run();
} finally {
  io.close();
}
