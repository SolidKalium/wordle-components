# Wordle Components

<p align="center">
  <img
    src="./public/project-mark-full.svg"
    alt="Wordle Components"
    width="240"
  >
</p>

This project provides a game engine and analysis tooling to investigate word choices and other patterns in the game. It contains components to run static or interactive analysis in the browser and via CLI.

Wordle is a trademark of The New York Times Company. This project is not affiliated with or endorsed by The New York Times. The word lists included in this project originate from Wardle's publicly visible code and are common online. The author is not aware of the NYT attempting to restrict distribution of these word lists.

## Ways to Interact with this Project

A [dev.md](dev.md) file exists and contains some minimal info.

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
    - Basic (the default mode): player must generate their own guesses without help
      - `-e` / `--explain`: Shows how many words are left, how the guess ranks compared according to a fixed `Strategy`, and what the best word would have been.
    - Quick-play `-q` / `--quickplay`: User is given a short list of plausible guesses on each turn
      - Pressing a number key fills in the corresponding word
  - `-g` / `--grade`: Computer plays against human word, with the human grading the guesses
    - Use `-w` to supply the word in advance and watch the computer play
    - Use `-e` to see words remaining on the committed line
    - The computer picks its first guess randomly from a small pool of good openers
    - Use <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd>, <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, or <kbd>Y</kbd><kbd>G</kbd><kbd>Space</kbd><kbd>Delete</kbd> to grade the guess, then press <kbd>Enter</kbd>. Use <kbd>Ctrl</kbd>+<kbd>Z</kbd> to undo a committed grading.
- **Analysis HTML page**
  - Explore strategies, see consequences
  - See [ui-spec](docs/ui-spec.md)
  - Rough design:
    - Card: mostly dumb, any info is pulled from the one thing inside it.
      - Can highlight itself when any other card with the same game/strategy Store is active (LATER)
    - Component: inputs or outputs a bundle of things (e.g. a game, strategy, etc). Kinda vague... and doesn't deal with cases where the game is shared but the strategy isn't.
      - Either analysis or selector
    - Component layout: abstracts multiple components into a visible shape, able to be slotted into a card instead of a single component. But this way the card only has one thing inside it.
    - Components use Stores in ContextProviders to share state, such as a game or strategy
      - Word list store is LATER
    - E.g. One card for either playing a game or entering an existing game state, then one card that just shows the current constraints in a different format, then one that allows exploring the full space of remaining 5 letter "words", then one that shows a decision tree for a particular algorithm. So one source of data can influence stats shown elsewhere.
  - Selector components for strategy
    - maybe one selector shows a minimal-ish set of options in an always-displayed config area, while another shows a gear icon with a popover? Or maybe some analyses work well for comparing two things and it's a mix of the two styles, with the selected feature for comparison always shown, and other settings a little more hidden
  - Component to visualize the implicit decision tree (for deterministic strategies)
  - Component to see the constraints. Useful for fact checking any typed inputs that an AI transforms.
  - Quick-play component: choose a word from a prepared menu on each turn, using a combination of random words and best or near-best words from multiple strategies.
    - Maybe allow filtering to options that include one player-chosen letter.
  - Separate pages for pre-built static and/or dynamic analysis report, and for build-your-own.
  - Any text-based analyses? E.g. that put the analysis into words instead of graphics.
  - Hypotheses and notes
    - The information-theoretic approaches likely provide similar quality of choices
      - Always picking a worse word by a metric, such as 90% best, might do worse regardless of which two information-theoretic strategies are used for top-1 and beats-90%.
        - Potential hypothesis «luck dominates between strategies that pick any reasonable top-quartile guess, because follow-up play recovers from a slightly suboptimal choice.»
    - There are different objectives: average moves, avoid high numbers of moves (e.g. within 6 moves). But the odds of needing more than 6 moves might already be low for any decent algorithm, other than dealing with traps in hard mode. So they might look pretty similar, again, other than the impact of traps in hard mode.
    - Full-depth trees for either objective might be meaningfully different. But we aren't calculating those yet.
    - Could show quality of a move in different strategies (score and order)
      - Could show this for a random sample of words. Inversions of order might be particularly useful to show, but that's harder to calculate. Well, maybe not that hard: calculate scores for options, then look for examples that differed by a lot between any two measures, or look at max and min values that differ a lot, maybe also ensuring each algorithm gets some repesentative highs and lows. Not sure if a graph would help at all. There's sort of too many words to do the snake graph thing (bump/slope chart) where options get re-ordered. Maybe one order is used as the baseline, it gets colors assigned, and then the re-ordered words are shown with that color system?
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
- Some features may need to degrade gracefully depending on settings. For instance anything in the UI that uses AI, since AI features in components might not be accessible.

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
- Update README: separate card display and visual testing (index.html / main.jsx) from any analysis report or formal experiments. Clean up anything that can be cleaned up.
- Analysis HTML UI
  - Decision tree
    - Show max moves?
    - Show tiny bar chart?
    - Add arg/toggle for words vs bits?
    - Add max height to columns
    - Allow choosing a different word for comparison?
    - Alternate tree views? Collapsible tree or treemap? But will struggle on turn 1 with 120-140 groups.
    - Once game board is added, make it re-anchor when a game exists and a move is made
      - Also: optionally track the partial input for the game and use that instead of the best move for the current game state
  - Game board
    - Separately: visualize constraints
      - A word has up to 5 letters. Could just show one row per letter found with green/yellow per square. Then a list of gray letters.
        - If built, make it possible to switch between col major and row major views.
        - Not really liking this.
      - Or could show per slot: The letter known or else the letters it excludes. Still a separate list of gray letters.
      - Per-position possibility sets: may need to avoid moving the letters. Maybe two or three columns per position, with a dividing line to keep positions separate?
        - At three columns, could use a rotated keyboard layout.
        - Or use a single through-line for each letter, with it effectively dropping out if it doesn't go there. Could combine with the letter frequency idea, varying width and/or color intensity based on remaining word compatibility. Color itself could reflect yellow vs green vs untested. To make the lines denser, can use two columns for the letter labels, with the bars reaching in between the letters of the second col to reach the first (think witch's stairs). Show a double letter label when a letter has two yellows. (Recall: 3 yellows is impossible for five letter words)
          - Hover or tap to highlight a row. Tap ought to also support dragging across them to highlight whichever is currently under the tap? Sounds a bit complicated. See if it looks good first.
      - Letter frequency over remaining words. Bar or sparkline? Better choice may just be normalizing the counts and using color intensity within a set range for the letters that have non-zero instances. Then another color or visual style for technically possible but incompatible with remaining words. And technically impossible letters (known gray tile or yellow tile) are just missing.
      - Something venn-like or a bit amorphous/fluid?
      - Ideally does know when a letter appears multiple times or has both a green and a yellow (or two!) remaining.
    - Separately: word entry (virtual keyboard)
      - Allow tap-to-move-cursor. Should it open the OS keyboard? Only if a virtual keyboard isn't attached?
      - Word input should be shareable with analysis things
        - filter brute force list
        - filter suggestions
        - Constraint view: highlight a guessed letter in the gray list if it is typed somewhere it can't be (here, I mean a subset of gray: 0 copies or all copies are green). Could emphasize the yellow square if a letter is placed that can't be there? Or just the letter in the square? Maybe the square and the specific letter? That might be the best option.
        - How is that property controlled? By user? By presence of a context? Probably just the context.
  - Hard mode toggle
  - Toggle or other setting for whether things like the suggester's words are from answers or all?
  - Other analysis components? E.g. compare across strategies
  - Pre-built composite components (LATER)
  - Brute force options list
    - When connected to a game, while the player is typing a guess: treats entered letters, other than ones that disagree with the constraints, as green. Or maybe treat all typed letters as green, even if they disagree with constraints? LATER
      - Should consider how the scroll position is preserved while the player types or deletes, and after committing a guess.
    - The position preservation when the constraint input is updated is known to be imperfect. It's often off by one because the scroller reports a different top row than a user would expect. A couple attempts didn't work, so the can is being kicked.
    - Add a search box when over a certain number of options? Maybe just scrolls to where that sequence would be? Or does it need to filter? Search and filter should be distinct modes and we may not need both.
  - Distribution Chart
    - Determine how the average is calculated, document. (does it include words past 6 guesses? Coerce them to 6 or 7?) Document on the component itself, in the UI.
  - Strategies: adjust scores for display to normalize values. E.g. avg group size, expected shannon entropy, expected group size, max group size. Instead of just using unnormalized values when the denominator is always the same.
    - Add descriptions for strategies?
  - Card
    - Highlight when Store active elsewhere? LATER
    - Consider additional themes? E.g. move the distinct header/content colors of the current chart demo card into its own color scheme
    - On bar hover, show representative words? Or all words?
  - Strategy selector
    - Additional variants? E.g. a popover from a settings icon.
    - Idea: could have a popover settings for whole card, then one for each component. The card can specify whether something is a default or locked. Then the individual components don't offer that setting. Combine with a +component design so a user can add/remove components and compare how they want.
  - Given every first word, how do the information theoretic approaches do on subsequent turns? Might go in a report page (or component) where finalized calculations and the code to make them are both stored?
    - This is effectively looking at each strategy's resilience to first-turn perterbation. Perhaps there's a comparable property for looking at global expected entropy or similar on before turn 3 or 4?
- Filters: tweak vowel anti-exploration? Maybe others? e.g. don't retry known bad letters
  - The letter and vowel exploration filters do nothing in hard mode because we are already limited to only words that match what we know, so after we filter out the remaining set, we fall back to the full one (or no letters matched yet and the filter is a no-op anyways). The word list being used (hard mode on/off, all or only possible answers) needs to be clearer in the UI.
- Test suite: HTML ?
- Revisit the three worker classes and how they relate?
- CLI: analysis? Delay until after HTML UI
- Cache precomputed rankings for first-turn guesses?
  - Probably create a script that knows the best first move on a few dimensions at once: all-guesses vs valid answers, hard mode on/off (won't matter for information-theoretic first turns, only exhaustive search), strategy, maybe certain filters. Assumes unchanged answer-word list. Probably include a hash of the list to validate the list and computed values match. Maybe warn somewhere in a build script if the computations are stale.
  - Might also cache related statistics for that first move? But if only needing stats for one guess, it shouldn't be too bad to recompute.
  - For some strategies, like the exhaustive ones or allowing all valid guesses, caching the second turn might also be useful.
  - May also want some kind of pool of first words of varying quality? A cache of some kind will help with the suggestions. apple
- Claude Skill
- Test suite: Claude Skill ?
- Strategy: full-depth calculation (min avg or minimax depth)
- Strategy: mixed strategy nash equilibrium ?

## Hypotheses and Analysis Topics
This was initially generated by LLM summary of a discussion.

### Strategy behavior
- Do single-step heuristics (group count, x², entropy, minimax) produce meaningfully different average guess counts?
- How much does the distribution overlap vs diverge? Is variance within a strategy (across words) larger than variance between strategies (for the same word)?
  - Variance within a strategy: entropy (for example) solves some words in 2 guesses and others in 5. The spread across different answer words is large — maybe a standard deviation of 0.8 guesses. (AI Hypothesis)
  - Variance between strategies: for the same answer word, entropy takes 4 guesses and x² also takes 4, or maybe 3. The difference between strategies on any given word is small — usually 0 or 1 guess. (AI Hypothesis)
  - But note that those aren't very comparable. So we might care more about cases where strategies produce 2 or more turns of difference for a word. Not quite sure how this should be calculated. "bits remaining" when the word was chosen is more like luck and just how it got split when the word was chosen. Naming and showing the variances is useful, but good framing for them or how to explore them in an interesting way is more difficult.
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
    - Show additional stats on each move, when -e is used? (In addition to words remaining.)
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
- Back out guesses from constraints? Filter the list of words to ones that comply with all constraints without implying knowledge beyond the constraints should be known, then do a best effort to pick words that enforce the remaining constraints, until all constraints are matched and no extra ones are introduced.
- Make text sizes more accessible: avoid px size for fonts and anything calculated based on them. This would be a lot of work, most likely, for an unknown number of users. Currently 0 of 0 users who aren't the author want this feature.

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
- i18n
- Allow selecting words from the larger valid word list ??
- Undefined behavior: using one input for multiple games
- Filters ("strategy subvariants") currently are designed to be hard, prepass filters with self-disable rules. That makes the logic clear and legible, with the input surface solely using integers. Filters can also be applied post-strategy.
  - Slightly more complex logical rules are possible but generally out of scope.
  - An alternative further out of scope would be to create and combine quality weights. But the process for doing that isn't obvious. How do we penalize letters that we've already used: multiply by 1 for each unused letter, .1 for each grey letter, .2 for each yellow or green letter in a position we haven't tried yet, and 0.05 otherwise? That might be too extreme. What's the right level of penalty for our goal? And how do we convert the preferences of any given strategy into a weight? What do the ihteractions between those weights do? How do we combine the filter and strategy weights? Multiply them? Take the minumum of the two, plus some portion of the larger one, but capped at twice the minumum and renormalized since that allowed the weights to go over 1? To avoid renormalizing, we could do `lo + min(lo, hi/x)*(1-lo)` or just `lo + (1-lo)*lo*hi`, but do we expect either of those to genuinely produce "good" or "meaningful" results for "good" choices of filter and strategy? The choice for combining likely depends on how much signal is intended to come from both halves, and possibly how many orders of magnitude the weights span.
- See [bias estimation doc](docs/bias-estimation.md). Extending player biases and player move analysis into guessing how a specific player would play in response to a word.

## What I Wish Official Wordle Had
- Completely censor a friend's first turn until I've finished the daily game, so I don't accidentally gain knowledge from it.
