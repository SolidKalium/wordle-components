import { SuggestionWorker } from '../src/ui/cli/SuggestionWorker.mjs';
import { ANSWERS } from '../src/lib/words.gen.mjs';
import { ConstraintState } from '../src/lib/constraints.mjs';
import { GREY, GREEN, YELLOW } from '../src/lib/core.mjs';

// Simulate state after guessing "slate" against answer "crane":
// s→grey, l→grey, a→green(pos2), t→grey, e→yellow
const cs = new ConstraintState();
cs.update('slate', [GREY, GREY, GREEN, GREY, YELLOW]);

const remaining = ANSWERS.filter(w => cs.matches(w));
console.log(`Remaining after "slate": ${remaining.length} words`);

const worker = new SuggestionWorker();
const suggestions = await worker.suggest(remaining);
console.log('Suggestions:', suggestions);
await worker.terminate();
