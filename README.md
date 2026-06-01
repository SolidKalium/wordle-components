# Wordle

## Ways to Interact with this Project

### Base Code
- `Analysis` can run a game with a known word and a known `Strategy`
  - TODO add more details on what it can do?
- `Game` can run a game where it knows the word and a UI can let the player make moves
- `Game` can run a game where it doesn't know the word and is supporting a `Strategy` trying to guess a player's word.
- `Core` can partition a set of words into groups that would look the same after a specific word is played.
- `Suggester` flexibly provides playable words from the strategies it is given. It can pick words only from possible answers or from the full word list.
  - The number of words chosen from each strategy, how they are picked, and how strictly that should be followed when the options are limited are all configurable.
  - TODO This may need to support differentiating deterministic and non-deterministic strategies and a way to pre-compute them so that they're fast. Although: deterministic strategies will have to handle different states if they suddenly have unexpected word choices and thus an unexpected state.
  - TODO If this is all in one worker, it can cache partitions for each word being considered, given a current game state, making strategies slightly faster.

See [strategies](#strategies) and [filters](#filters) for info about those options.

### UIs
- **Command line**
  - Run `./wordle` to play in the console. Use `-h` to see options.
  - `TerminalIO` abstraction supports both native terminal and xterm.js rendering
  - User plays against a computer-chosen word
    - Basic: player must generate their own words without help
      - Explanation flag: Shows how many words are left, how the guess ranks compared according to a fixed `Strategy`, and what the best word would have been.
    - Quick-play: User is given a short list of plausible guesses on each turn
      - Pressing a number key fills in the corresponding word
  - Computer plays against human word, with the human grading the guesses
    - Use `-w` to supply the word in advance and watch the computer play
    - Use `-e` to see words remaining on the committed line
    - The randomly computer uses one of a small number of good guesses on the first turn
    - Use the keyboard (arrow keys, WASD or Y/G/\[space]) to grade the guess, then press \[enter]. Use ctrl+z to undo a committed grading.
    - Use <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd>, <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, or <kbd>Y</kbd><kbd>G</kbd><kbd>Space</kbd><kbd>Delete</kbd> to grade the guess, then press <kbd>Enter</kbd>. Use <kbd>Ctrl</kbd>+<kbd>Z</kbd> to undo a committed grading.
- **Analysis HTML page**
  - Decompose problem into useable UI chunks. Both analysis components and selector components.
    - TODO Design further. Explore strategies, see consequences
  - Component to visualize the implicit decision tree (for deterministic strategies)
  - Component for the CLI version, for demo purposes
  - Rapid-play component: choose a word from a prepared menu on each turn, using a combination of random words and best or near-best words from multiple strategies. Maybe allow filtering to options that include one player-chosen letter.
  - Possibly split an "official" static analysis report from a dynamic one. Though they might be tabs of the same page, or something similar.
  - Hypotheses and notes
    - The information-theoretic approaches likely provide similar quality of choices
    - There are different objectives: average moves, avoid high numbers of moves (e.g. within 6 moves). But the odds of needing more than 6 moves might already be low for any decent algorithm, other than dealing with traps in hard mode. So they might look pretty similar, again, other than the impact of traps in hard mode.
    - Full-depth trees for either objective might be meaningfully different. But we aren't calculating those yet.
    - Could show quality of a move in different strategies (score and order)
      - Could show this for a random sample of words. Inversions of order might be particularly useful to show, but that's harder to calculate. Not sure if a graph would help at all. There's sort of too many words to do the snake graph thing (bump/slope chart) where options get re-ordered. Maybe one order is used as the baseline, it gets colors assigned, and then the re-ordered words are shown with that color system?
- **React in Claude**
  - TBD, but likely things based on the CLI and Analysis UIs, plus support for anything the skill needs.

### Claude Skill
- Some kind of coach
  - Suggest some possible, decent moves
  - Trap detection: "You have 6 remaining words and they differ only in the first letter: _IGHT. You can't distinguish them one at a time. Do you have a guess that tests multiple first letters at once?"
  - What else would a coach do?
- Give some gamestate statistics
  - How many words remain
  - Expected move count to win
- Give move statistics (what-if analysis and post-move analysis)
  - How many groups are there, what would the distribution of their sizes look like?
  - Could offer features inspired by the official analysis
    - For instance rating the "luck" of a move vs the optimalness.
    - Maybe estimate popular human moves, based on biases or other properties?
- Only if directly asked, give the move that a specified algorithm would select
- Initialize a game with a random word and let the player play it?
- Ability to import a game that's in the middle of play. E.g. words played and their outputs grey/green/yellow or simply a summary of what's known.
- Awareness of hard mode or other constraints.
- Structural note: interacting with an active game artifact should be different from a self-contained question and answer.
- Tool to identify likely first guess words of friends. Eg given the letterless info for the first line and the actual word of the day, find compatible words, especially given data for multiple days.
- Perhaps enable transforming pictures of games into a set format? E.g. json, markdown, or a flexible html layout. Or enabling custom strategies to be exported in some way that lets them be verifiably consistent across sessions.
- Check if a word is in the wordle list. Or possibly just find words that have a property via a filter.

## Strategies
- Smallest average group size
  - This is the same as maximizing the number of groups
- Entropy minimization
  - This is the same as minimizing sum of n*lg(n) across groups.
- Minimize the number of words in the same group as a word
  - This is the same as minimizing the average square of group size
- Minimax group size
- Something using entropy better? Essentially optimizing over multiple moves instead of just one
- Filtered Strategies: limit the words another strategy considers by applying zero or more `Filters`.
- Actively add randomness to the strategy so that the guesses needed for any particular word is minimized. The purpose is to make a strategy that can't be forced into taking the maximum turns, even when the opponent knows the strategy, like playing rock, paper, and scissors randomly with equal frequency. Keywords: Nash Equilibrium, repeated games, mixed strategy.
  - Minimize the maximum *expected* guesses to find a word. No matter what word the adversary picks, the expected number of guesses needed should be minimized.

## Filters
Filters can be used post-strategy to find a subset of ranked results, or they can be used to filter the inputs to a strategy using a `FilteredStrategy`. Some filters are designed more for pre-filtering and some more for post-filtering, but they all be used either way. Post-filtering is useful for a human who wants words from a strategy that have some particular property.

- Letter Exploration: only use unexplored letters, if possible
- Vowel Exploration: try new vowels where possible. This prefers checking for the existence of other distinct vowels instead of locating yellow vowels.
- Anti Vowel Exploration: only use vowels that have already been tried, if possible
- Must Contain: accepted words must *contain* the *full* specified letter *multiset*
- Scrabble: accepted words must *only use* letters in the specified letter *multiset*
- Keyboard: accepted words must *only use* letters in the specified letter *set*

## TODO
- CLI UI
  - Cleanup README, add any notes to CLI md
- Analysis HTML UI
  - CLI component
  - Decision tree
  - Other analysis components
  - Selector component(s) to wrap analyses
  - Make it work as a github page with low per-repo setup
- Strategies: adjust scores for display to normalize values. E.g. avg group size, expected shannon entropy, expected group size, max group size. Instead of just using unnormalized values when the denominator is always the same.
- Test suite: HTML ?
- Rapid-play mode in HTML
- CLI: analysis? Delay until after HTML UI
- Cache precomputed rankings for first-turn guesses?
- Claude Skill
- Test suite: Claude Skill ?
- Strategies: full-depth calculation (min avg or minimax depth), mixed strategy nash equilibrium ?

## Hypotheses and Analysis Topics
This was generated by LLM summary of a discussion.

### Strategy behavior
- Do single-step heuristics (group count, x², entropy, minimax) produce meaningfully different average guess counts?
- How much does the distribution overlap vs diverge? Is variance within a strategy (across words) larger than variance between strategies (for the same word)?
- Which specific words cause the most disagreement between strategies? What properties do those words share?
- How does the "penalty curve" differ — where does entropy tolerate a large group that x² wouldn't, and vice versa?
- For a given game state, compare the top-k word recommendations across strategies: which words appear in multiple strategies' top lists, which are unique to one?

### Partition exploration
- Given a guess and remaining words, what does the partition look like? Group count, size distribution, largest group.
- Compare two guesses' partitions side by side.
- "What if" exploration: pick a guess, pick an outcome group, see the next level of partitions. Essentially walking the decision tree interactively.
- For deterministic strategies, show the full pre-computed decision tree (or a subtree rooted at the current state).

### Filter analysis
- Does a filter (avoid explored letters, vowel exploration) change which guess a strategy picks? How often?
- How does filter auto-disable behavior interact with game progression — at what turn or remaining-word-count do filters typically deactivate?
- Compare filtered vs unfiltered strategy performance distributions.

### Traps and hard mode
Identify trap states in the word list: groups of words differing in only one position. How many exist? How large?
How do different strategies handle a known trap state? Does minimax outperform entropy here as predicted?
Hard mode vs normal mode performance comparison per strategy. Where does the constraint hurt most?
For hard mode specifically: how often does the optimal guess (by any single-step metric) differ from the optimal guess that also satisfies hard mode constraints?

### Information-theoretic claims
- Shannon entropy gives a lower bound (bits needed). What's the actual average bits obtained per guess? How far is the gap?
- Does the gap between theoretical and achievable information vary by game state? Is it largest in trap-like states?
- Across the full word list, what's the distribution of "first guess information yield" — how many bits does each possible opening guess provide?

### Luck vs skill decomposition
- For a completed game: was the answer in a large or small partition group at each step? A player who lands in small groups repeatedly was lucky regardless of strategy.
- Separate "was this a good guess given what was known" from "did the outcome happen to be favorable."
- Could show: expected remaining words after a guess vs actual remaining words, across turns.

### Opening analysis
- What are the best opening words by each metric? How much do the top-10 lists overlap?
- After a fixed opening word, what second-guess does each strategy prefer? Does this vary more than the opening choice?

### The tree search question (future)
- Once heuristic strategy results exist: on the words where strategies disagree, what does the optimal full-tree solution actually do? Does it match any single heuristic, or something none of them found?
- How often does the true optimal guess rank outside the top 10% of any single-step heuristic? This determines whether beam search is safe.

### Player modeling (bonus section connections)
- Human bias catalog items are testable against the word list: which words have unusual positional letter frequencies, atypical phonology, rare bigrams, duplicate letters? These properties could be displayed alongside strategy recommendations as "human difficulty predictors."

## Postponed / LATER
- CLI
  - If the UI will become more complicated, consider using Ink and ink-web or ink-canvas
  - Quickplay
    - Flag to not require enter after pressing a number?
    - Flag to not even allow a custom word in quickplay?
    - Explanation flag to show how the words actually ranked?
    - Use a Suggester instead of the weaker reimplementation currently being used
  - Grading mode
    - Show additional stats on each move, when -e is used?
    - Support a choice of algorithm? This might belong in the analysis section instead of here.
  - Flashcard mode: The player is rewarded for choosing the actual best move, and it's always available. Filler words might not be the next-best words overall, but instead be words that are the best on the next turn or two according to the deterministic algorithm.
  - Analyses. Delay at least until after HTML UI for analyses
  - «terminal background detection is unreliable, design with mid-range colors that work on both, offer a flag as override, and optionally attempt OSC 11 as a nicety.»
  - Support config menus in addition to CLI args? Possibly not
    - Mode picker might be most useful GUI
    - Config format for things like filtered strategies would need to be determined. This is related to how any HTML component configs could be saved, stored, or specified by a Skill. But config "files" are out of scope for now.
    - Maybe start with one game per command run, but then allow it to go repeatedly, possibly with a flag to control that behavior. Repeated runs allow any GUI-specified settings to persist.
- Strategies
  - What if we didn't restrict the word at all and any sequence of letters were allowed?
    - Mainly postponed because we don't want to check 26^5 (10^7) options. If we can reduce the set of letters we might want to check on the first turn to 16 options, then that's only 10^6, which is still a lot of brute force... But with some thought, this might have a better approach. But letter frequency and place frequency could make this complicated. And we don't necessarily want the most frequent letters, but letters and positions that split as many groups as possible. Which might point towards just trying all the vowels on the first move, since most words will have 2 or 3 of them. Which might imply that we'd want to place each vowel where it is most common in words with only one distinct vowel, but effects on other paths might overwhelm that... So I'm now leaning towards an incremental search algorithm that explores variants of a strategy. E.g. swap two letters, replace a letter, while tracking options discarded. Might need to prove convex properties to trust that, but it might just do ok. And some varied starting choices converging to the same result could provide a sanity check in lieu of a proof.

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

## Out of Scope
Things considered but skipped for now

- Word lengths other than 5
- Allow selecting words from the larger valid word list
- Filters ("strategy subvariants") currently are designed to be hard, prepass filters with self-disable rules. That makes the logic clear and legible, with the input surface solely using integers. Filters can also be applied post-strategy.
  - Slightly more complex logical rules are possible but generally out of scope.
  - An alternative further out of scope would be to create and combine quality weights. But the process for doing that isn't obvious. How do we penalize letters that we've already used: multiply by 1 for each unused letter, .1 for each grey letter, .2 for each yellow or green letter in a position we haven't tried yet, and 0.05 otherwise? That might be too extreme. What's the right level of penalty for our goal? And how do we convert the preferences of any given strategy into a weight? What do the ihteractions between those weights do? How do we combine the filter and strategy weights? Multiply them? Take the minumum of the two, plus some portion of the larger one, but capped at twice the minumum and renormalized since that allowed the weights to go over 1? To avoid renormalizing, we could do `lo + min(lo, hi/x)*(1-lo)` or just `lo + (1-lo)*lo*hi`, but do we expect either of those to genuinely produce "good" or "meaningful" results for "good" choices of filter and strategy? The choice for combining likely depends on how much signal is intended to come from both halves, and possibly how many orders of magnitude the weights span.
- See [bias estimation doc](docs/bias-estimation.md). Extending player biases and player move analysis into guessing how a specific player would play in response to a word.

## What I Wish Official Wordle Had
- Completely censor a friend's first turn, so I don't accidentally gain knowledge from it.
