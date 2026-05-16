# Wordle

Practicing working with Claude

This project should include:
- Solver code
- UI options
  - Command line
  - React in claude
- Skill
  - Some kind of "coach"?
    - Suggest some possible, decent moves
    - What else would a coach do?
  - Give some gamestate statistics
    - How many words remain
    - Expected move count to win
  - Give move statistics
    - How many groups are there, what would the distribution of their sizes look like?
    - Could look at what the official analysis does. For instance rating the "luck" of a move vs the optimalness. Maybe estimate popular human moves, based on biases or other properties?
  - Only if directly asked, give the move that a specified algorithm would select
  - Initialize a game with a random word and let the player play it?

## Strategies
- Smallest average group size
- Minimax group size
- Something using entropy better? Essentially optimizing over multiple moves instead of just one
- Maybe some kind of vowel-exploration strategy? Kinda implicit in other strategies, so how this differs might need to be clarified
- Actively avoid vowel exploration? (possibly a "substrategy" of another strategy?)
- Actively avoid letters that were already guessed? (possibly a "substrategy" of another strategy?)
- Actively add randomness so that the guesses needed for any particular word is minimized. Not exactly sure what this metric is. But the purpose is to make a strategy that can't be forced into taking the maximum turns, even when the opponent knows the strategy, like playing rock, paper, and scissors randomly with equal frequency.
  - Minimize the maximum *expected* guesses to find a word?
  - Minimize the average *expected* guesses to find the 20% of words with the highest number of guesses needed.
    - This seems harder to calculate, and the 20% is arbitrary.
    - This kind of seems worse. It permits some words to still be expected to take many turns. Both approaches "ignore" the faster to guess words, but really, the turns needed to guess those are just unconstrained to leave room for improving the harder to guess words, so that's fine and not different between them.
    - I guess I'm just leaving the idea as a note, but just planning to move it to out-of-scope once the other strategy is implemented.

We may want to visualize the implicit decision tree? (for deterministic strategies)
Maybe strategies should be able to return multiple words, either as a simple ordered list or with weights? This would support the skills that suggest words.

## Other Topics
- I'm curious about what might bias a human against quickly finding a word.
  - Weight words by usage or common knowledge. E.g. most people know the word `penis` but it might be underrepresented in some text corpora. Players might also believe a "dirty" or "sensitive" word is unlikely to be the answer.
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
