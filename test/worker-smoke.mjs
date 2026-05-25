import { SuggestionWorker } from '../src/ui/cli/SuggestionWorker.mjs';
import { ANSWERS } from '../src/lib/words.gen.mjs';
import { ConstraintState } from '../src/lib/constraints.mjs';
import { GREY, GREEN, YELLOW } from '../src/lib/core.mjs';

// Simulate state after guessing "crane" against answer "ghost":
// c→grey, r→grey, a→grey, n→grey, e→grey
const cs = new ConstraintState();
cs.update('crane', [GREY, GREY, GREY, GREY, GREY]);

const remaining = ANSWERS.filter(w => cs.matches(w));
console.log(`Remaining after "crane" all-grey: ${remaining.length} words`);

const worker = new SuggestionWorker();
// Rank 'ghost' among the remaining words (it's the answer, still a candidate).
const result = await worker.compute(remaining, 'ghost');
console.log('Suggestions:', result.words);
console.log(`ghost ranked ${result.rank}/${result.total} (top ${Math.round(result.rank/result.total*100)}%). Best: ${result.bestWord}`);
await worker.terminate();
