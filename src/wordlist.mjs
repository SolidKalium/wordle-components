import { readFileSync } from 'node:fs';
import { WORD_LENGTH } from './core.mjs';

/**
 * Load a word list from a newline-separated text file.
 * Normalizes to lowercase and filters to WORD_LENGTH-letter words.
 *
 * @param {string} path - Path to the word list file.
 * @returns {string[]} Sorted, deduplicated word list.
 */
export function loadWordList(path) {
  const text = readFileSync(path, 'utf-8');
  const words = text
    .split('\n')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length === WORD_LENGTH && /^[a-z]+$/.test(w));

  return [...new Set(words)].sort();
}

/**
 * Inline word list for quick testing without a file.
 * ~50 common words — enough to exercise the engine, not enough for real play.
 */
export const TEST_WORDS = [
  'about', 'apple', 'beach', 'black', 'blank', 'blast', 'blaze', 'bloom',
  'brain', 'bread', 'build', 'cabin', 'chair', 'chase', 'cheap', 'chess',
  'climb', 'close', 'cloud', 'couch', 'crane', 'crass', 'crawl', 'dance',
  'draft', 'drain', 'dream', 'drink', 'drive', 'earth', 'feast', 'flame',
  'flesh', 'float', 'flood', 'flour', 'flute', 'frame', 'fresh', 'frost',
  'ghost', 'grace', 'grain', 'grape', 'grasp', 'green', 'grind', 'gross',
  'guard', 'guest', 'guide', 'heart', 'house', 'jolly', 'juice', 'knack',
  'laugh', 'light', 'lunar', 'mango', 'match', 'night', 'oxide', 'paste',
  'plant', 'plead', 'plumb', 'pouch', 'proud', 'quest', 'quiet', 'raise',
  'roast', 'robin', 'saint', 'salty', 'share', 'sharp', 'shawl', 'shine',
  'slate', 'sleep', 'smart', 'snail', 'solar', 'space', 'spade', 'stale',
  'stand', 'steam', 'stern', 'stone', 'stove', 'sugar', 'swear', 'swift',
  'those', 'thumb', 'toast', 'trace', 'trade', 'trail', 'train', 'trash',
  'trend', 'tried', 'trunk', 'ultra', 'venom', 'watch', 'water', 'whale',
  'wheat', 'world', 'wound', 'wrist', 'young',
];
