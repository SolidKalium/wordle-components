# Wordle

Practicing working with Claude

This project should include:
- Solver and utility code
- UI options
  - Command line
  - React in claude
- Skill
  - Some kind of coach
    - Suggest some possible, decent moves
    - Trap detection: "You have 6 remaining words and they differ only in the first letter: _IGHT. You can't distinguish them one at a time. Do you have a guess that tests multiple first letters at once?"
    - What else would a coach do?
  - Give some gamestate statistics
    - How many words remain
    - Expected move count to win
  - Give move statistics (what-if analysis and post-move analysis)
    - How many groups are there, what would the distribution of their sizes look like?
    - Could look at what the official analysis does.
      - For instance rating the "luck" of a move vs the optimalness.
      - Maybe estimate popular human moves, based on biases or other properties?
  - Only if directly asked, give the move that a specified algorithm would select
  - Initialize a game with a random word and let the player play it?
  - Ability to import a game that's in the middle of play. E.g. words played and their outputs grey/green/yellow or simply a summary of what's known.
  - Awareness of hard mode or other constraints.
  - Structural note: interacting with an active game artifact should be different from a self-contained question and answer.
  - Tool to identify likely first guess words of friends. Eg given the letterless info for the first line and the actual word of the day, find compatible words, especially given data for multiple days.
  - Perhaps enable transforming pictures of games into a set format? E.g. json, markdown, or a flexible html layout.

## Strategies
- Smallest average group size
  - This is the same as maximizing the number of groups
- Minimize the number of words in the same group as a word
  - This is the same as minimizing the average square of group size
- Minimax group size
- Something using entropy better? Essentially optimizing over multiple moves instead of just one
- Filtered strategies
  - Avoid vowel exploration: only use vowels that have already been tried, if possible
  - Prefer exploration: only use unexplored letters, if possible
  - Vowel exploration: try new vowels where possible. This prefers checking for the existence of other distinct vowels instead of locating yellow vowels.
- Actively add randomness to the strategy so that the guesses needed for any particular word is minimized. The purpose is to make a strategy that can't be forced into taking the maximum turns, even when the opponent knows the strategy, like playing rock, paper, and scissors randomly with equal frequency. Keywords: Nash Equilibrium, repeated games, mixed strategy.
  - Minimize the maximum *expected* guesses to find a word. No matter what word the adversary picks, the expected number of guesses needed should be minimized.

Notes
- We may want to visualize the implicit decision tree? (for deterministic strategies)
- Maybe strategies should be able to return multiple words, either as a simple ordered list or with weights? This would support the skills that suggest words.
  - Weights and ranked order may be a flag that chooses the format, or function output could include both. [{ word, score, groups, maxGroup, avgGroup, weight }]

## Other Topics
- I'm curious about what might bias a human against quickly finding a word.
  - Weight words by usage or common knowledge
    - E.g. most people may know a word that is relatively rare in some text corpora. A word might be used more often verbally than in formal or informal writing. Or name something that doesn't need to be discussed often but is still commonly known.
    - Players might also believe a "dirty" or "sensitive" word is unlikely to be the answer. Note that `penis` is excluded from the default answer list, but `lynch` and `kinky` are included.
    - Note: it appears that many plurals and "derived" words like `times` and `timed` are excluded. Even `tired` is excluded.
  - Words with letters that aren't common in a particular position. Rareness may be defined relative to other letters known to be in the answer (fixed location or unknown location).
  - Words with letters, especially vowels, pronounced differently in that position than other words with the letter in that position. Rareness may be defined relative to other letters known to be in the answer (fixed location or unknown location).
  - Words that avoid certain common pairs of letters. E.g. -er, -ed, -th-, -ch-, etc
  - Words with 2 or 3 copies of a letter
  - Maybe use observations from these properties to simulate how a player might guess when blind to the impact on the remaining word list. Then maybe see how well any one or two properties alone do well at picking words that are "hard" for players with the full set of expected biases.
    - The simulated biases may need some level of variation, in additon to the randomness? Or maybe a single level of randomness is strong enough.

## TODO
- UI
- Skill
- Strategies
- Analysis

## Out of Scope
Things considered but skipped for now

- Word lengths other than 5
- Allow selecting words from the larger valid word list
- Filters ("strategy subvariants") currently are designed to be hard, prepass filters with self-disable rules. That makes the logic clear and legible, with the input surface solely using integers.
  - Slightly more complex logical rules are possible but generally out of scope.
  - An alternative further out of scope would be to create and combine quality weights. But the process for doing that isn't obvious. How do we penalize letters that we've already used: multiply by 1 for each unused letter, .1 for each grey letter, .2 for each yellow or green letter in a position we haven't tried yet, and 0.05 otherwise? That might be too extreme. What's the right level of penalty for our goal? And how do we convert the preferences of any given strategy into a weight? What do the ihteractions between those weights do? How do we combine the filter and strategy weights? Multiply them? Take the minumum of the two, plus some portion of the larger one, but capped at twice the minumum and renormalized since that allowed the weights to go over 1? To avoid renormalizing, we could do `lo + min(lo, hi/x)*(1-lo)` or just `lo + (1-lo)*lo*hi`, but do we expect either of those to genuinely produce "good" or "meaningful" results for "good" choices of filter and strategy? The choice for combining likely depends on how much signal is intended to come from both halves, and possibly how many orders of magnitude the weights span.
