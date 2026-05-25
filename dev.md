# Developer Guide

## Setup

```sh
npm install
npm run generate   # build src/lib/words.gen.mjs from words/
```

`npm run generate` must be re-run any time the source word lists in `words/` change. The output (`src/lib/words.gen.mjs`) is committed to the repo so the browser build has no `node:fs` dependency.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run smoke` | Quick end-to-end sanity check (`test/smoke.mjs`) |
| `npm run generate` | Regenerate `src/lib/words.gen.mjs` from `words/` |

## Project structure

``` text
src/
  lib/           Engine — pure logic, no I/O, browser-safe
  ui/            UIs (CLI, HTML components) — to be added
  worker/        Web Worker entry points — to be added
  main.jsx       React entry point
test/            Vitest test suite (imports from src/lib/)
scripts/         Build/codegen tools (Node.js only)
words/           Source word lists (not generated)
  wordle-answers.txt   2315 curated answer words
  wordle-valid.txt     ~10 657 valid-but-not-answer words
```

## Word lists

`words.gen.mjs` exports two arrays:

- **`ANSWERS`** — curated answer pool (from `wordle-answers.txt`).
- **`WORDS`** — all valid guesses: `ANSWERS ∪ wordle-valid.txt`, used for guess validation.

To replace or update the word lists, edit the `.txt` files and re-run `npm run generate`. The format is one word per line, any case; the script normalises, deduplicates, and sorts.

`TEST_WORDS` in `src/lib/wordlist.mjs` is a separate small list used only in tests. It stays stable regardless of what the real word lists contain.
