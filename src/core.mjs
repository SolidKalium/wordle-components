// Result markers for each position in a guess.
export const GREEN = 'G';
export const YELLOW = 'Y';
export const GREY = '_';

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

// All greens pattern, precomputed for solved-check.
const ALL_GREEN = [GREEN, GREEN, GREEN, GREEN, GREEN];
export const ALL_GREEN_STR = ALL_GREEN.join('');

/**
 * Compute the Wordle result pattern for a guess against an answer.
 *
 * Handles duplicate letters correctly:
 *   1. First pass marks exact matches (GREEN) and claims those answer positions.
 *   2. Second pass marks positional mismatches (YELLOW) by claiming unclaimed
 *      answer positions left-to-right. Unclaimed guess letters with no remaining
 *      match get GREY.
 *
 * @param {string} guess  - 5-letter guess
 * @param {string} answer - 5-letter answer
 * @returns {string[]} Array of 5 GREEN/YELLOW/GREY values
 */
export function computePattern(guess, answer) {
  const pattern = [GREY, GREY, GREY, GREY, GREY];
  const answerUsed = [false, false, false, false, false];
  const guessUsed = [false, false, false, false, false];

  // Pass 1: greens
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) {
      pattern[i] = GREEN;
      answerUsed[i] = true;
      guessUsed[i] = true;
    }
  }

  // Pass 2: yellows
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessUsed[i]) continue;
    for (let j = 0; j < WORD_LENGTH; j++) {
      if (answerUsed[j]) continue;
      if (guess[i] === answer[j]) {
        pattern[i] = YELLOW;
        answerUsed[j] = true;
        break;
      }
    }
  }

  return pattern;
}

/**
 * Encode a pattern array as a compact string, e.g. "GY__G".
 */
export function patternToString(pattern) {
  return pattern.join('');
}

/**
 * Decode a pattern string back to an array.
 */
export function patternFromString(str) {
  return [...str].map(c => {
    if (c === GREEN || c === YELLOW || c === GREY) return c;
    throw new Error(`Invalid pattern character: '${c}'`);
  });
}

/**
 * Encode a pattern as a single integer 0–242 (base-3: G=2, Y=1, _=0).
 * Useful as a compact Map key or array index.
 */
export function patternToInt(pattern) {
  const vals = { [GREEN]: 2, [YELLOW]: 1, [GREY]: 0 };
  return pattern.reduce((acc, c) => acc * 3 + vals[c], 0);
}

/**
 * Decode an integer 0–242 back to a pattern array.
 */
export function patternFromInt(n) {
  const chars = [GREY, YELLOW, GREEN];
  const pattern = [];
  for (let i = 0; i < WORD_LENGTH; i++) {
    pattern.unshift(chars[n % 3]);
    n = Math.floor(n / 3);
  }
  return pattern;
}

/**
 * Partition a list of candidate words by the pattern each would produce
 * if `guess` were played against it.
 *
 * @param {string} guess - The candidate guess
 * @param {string[]} words - Words to partition (typically the remaining valid words)
 * @returns {Map<string, string[]>} Pattern string → list of words producing that pattern
 */
export function partitionByGuess(guess, words) {
  const groups = new Map();
  for (const word of words) {
    const key = patternToString(computePattern(guess, word));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(word);
  }
  return groups;
}
