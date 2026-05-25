# Wordle

Practicing working with Claude

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
  - `TerminalIO` abstraction supports both native terminal and xterm.js rendering
  - UI or command to pick a mode. Both may be good to support.
    - Probably start out only having the computer run the min expected group size strategy. Then an optional "game config" panel or command line arguments can be supported.
      - Config format for things like filtered strategies would need to be determined. This is related to how any HTML component configs could be saved, stored, or specified by a Skill.
        - Config "files" are out of scope for now.
    - Maybe start with one game per command run, but then allow it to go repeatedly, possibly with a flag to control that behavior. Repeated runs allow any settings to persist.
  - Help info on `--help`, `help`, and `-h`
  - Maybe `about`, `--version`, or `-v` support? Unknown commands invoke help anyways, so `about` might just be one such invalid word, as could `help`.
  - Add a basic shell script like `wordle` or `play` in the repo root that calls npm and passes along any arguments?
  - User plays against a computer-chosen word
    - Basic: player must generate their own words without help
      - Explanation flag: Shows how many words are left, how the guess ranks compared according to a fixed `Strategy`, and what the best word would have been.
    - Quick-play: User chooses from a short list of plausible guesses from a `Suggester`
      - Explanation flag? After a choice, shows how the words actually rank
      - Allow using a number key to select a suggested word. Ideally just pressing, not requiring Enter.
      - ... this reimplemented the Suggester instead of using one...
    - LATER Flashcard submode? The player is rewarded for choosing the actual best move, and it's always available. Filler words might not be the next-best words overall, but instead be words that are the best on the next turn or two according to the deterministic algorithm.
    - UX improvements, using raw mode
      - While typing, a letter that is known to be green, yellow, or gray in that spot can show that as the background. But a letter that is yellow elsewhere can be shown with a yellow text color.
      - Ideally, warn the user about removing green letters or not trying a yellow letter.
    - LATER? support CLI args or config menus
  - Computer plays against human word using human-chosen strategy, with human grading
    - Optionally show stats on each move
    - Making keyboard input control the colors under the computer's guess would be good.
      - G/Y/_ would work but be cumbersome.
      - Default of gray for each letter. Up (green), Down (yellow), Right (go forward), Left (backup), Delete (gray), Space or Enter (commit grading). Might or might not support an empty space past the end of the word. Could support WASD or numpad as an alternate. Could support an alternate "return to gray" key (minus? do up and down cycle the colors in a circle instead of being specific colors? We could hint the up/down colors with like just a pixel or two in a lighter version of the color, if that's possible.) Need an undo command, probably just command/ctrl z? Also need to handle an interrupt gracefully.
        - Note: arrow keys might be harder than they seem. Start with WASD and add arrow keys as an upgrade. They use an escape sequence and it can vary accross keyboards. Could need ink, terminal-kit, or `process.stdin.setRawMode(true)`.
      - If the computer knows that a letter was already (or must be) green in that spot, it can prefill that. Before making a guess, it can ensure that the new feedback is compatible with what is known: the total letters asserted as yellow or green isn't inherently greater than the word list, and no yellow letters turned gray (after accounting for quantity). No previously gray letter should become green or yellow. Issues can be listed to the right or on one or more info lines below the guess being operated on. ("Letters that shouldn't be gray: XYZ. Letters that should be gray: ABC. To back up a turn, press cmd+z.")
    - Need to handle fixing the grading on an earlier turn.
    - Can allow the computer to know the word in advance and just let the player pace through with Space/Enter. E.g. "Enter your word for auto-play (blank will let you grade the guesses manually):" (that parenthetical could just be in a lighter text color after the colon while nothing has been typed in)
  - LATER? analyses. Probably delay until after HTML UI
- **Analysis HTML page**
  - Decompose problem into useable UI chunks. Both analysis components and selector components.
    - TODO Design further. Explore strategies, see consequences
  - Component to visualize the implicit decision tree (for deterministic strategies)
  - Component for the CLI version, for demo purposes
  - Rapid-play component: choose a word from a prepared menu on each turn, using a combination of random words and best or near-best words from multiple strategies. Maybe allow filtering to options that include one player-chosen letter.
  - Possibly split an "official" static analysis report from a dynamic one. Though they might be tabs of the same page, or something similar.
  - Need to load word list either dynamically or via inlining/compiling.
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
  - Add command-line flags
  - Add help page
  - Add `--version` / `-v`
  - Add raw mode support. Use any libraries to support this?
    - Basic, Quickplay, and Quickplay Explanation
  - Add user guess-grading mode
  - Add any strategy/suggester config access
- Test suite: CLI ?
- Analysis HTML UI
  - CLI component
  - Decision tree
  - Other analysis components
  - Selector component(s) to wrap analyses
- Test suite: HTML ?
- Rapid-play mode in CLI or HTML?
- CLI: analysis? Delay until after HTML UI
- Cache precomputed rankings for quesses on the first turn?
- Claude Skill
- Test suite: Claude?
- Strategies: entropy, mixed strategy nash equilibrium

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
