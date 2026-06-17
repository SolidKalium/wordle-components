import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ANSWERS, WORDS } from '../../../lib/words.gen.mjs';

const ANSWERS_SET = new Set(ANSWERS);
import { useConstraintStore } from '../stores/constraintStore.js';
import { BrowserSuggestionWorker } from '../workers/BrowserSuggestionWorker.mjs';
import styles from './ConstraintEditor.module.css';

const GreenRow = forwardRef(function GreenRow({ onUp, onDown }, ref) {
  const green    = useConstraintStore(s => s.green);
  const setGreen = useConstraintStore(s => s.setGreen);
  const refs     = useRef(Array.from({ length: 5 }, () => null));

  useImperativeHandle(ref, () => ({
    focus: col => refs.current[Math.max(0, Math.min(4, col))]?.focus(),
  }), []);

  return (
    <div className={styles.slots}>
      {green.map((letter, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          className={`${styles.tile} ${styles.greenTile} ${letter ? styles.greenFilled : ''}`}
          value={letter?.toUpperCase() ?? ''}
          maxLength={2}
          onFocus={e => { const len = e.target.value.length; e.target.setSelectionRange(len, len); }}
          onChange={e => {
            // Handles paste / mobile IME only — regular typing goes through onKeyDown.
            const ch = e.target.value.replace(/[^a-zA-Z]/g, '').slice(-1).toLowerCase() || null;
            setGreen(i, ch);
          }}
          onKeyDown={e => {
            if (/^[a-zA-Z]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
              e.preventDefault();
              setGreen(i, e.key.toLowerCase());
              if (i < 4) refs.current[i + 1]?.focus();
              return;
            }
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (letter) {
                setGreen(i, null);
              } else if (i > 0) {
                setGreen(i - 1, null);
                refs.current[i - 1]?.focus();
              }
              return;
            }
            if (e.key === 'Delete') {
              e.preventDefault();
              if (letter) setGreen(i, null);
              return;
            }
            if (e.key === 'ArrowLeft'  && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < 4) refs.current[i + 1]?.focus();
            if (e.key === ' ')         { e.preventDefault(); if (i < 4) refs.current[i + 1]?.focus(); }
            if (e.key === 'ArrowUp')   { e.preventDefault(); onUp?.(i); }
            if (e.key === 'ArrowDown') { e.preventDefault(); onDown?.(i); }
          }}
        />
      ))}
    </div>
  );
});

const YellowRow = forwardRef(function YellowRow({ onUp, onDown }, ref) {
  const yellow    = useConstraintStore(s => s.yellow);
  const setYellow = useConstraintStore(s => s.setYellow);
  const refs      = useRef(Array.from({ length: 5 }, () => null));
  const cursorRef = useRef(null); // pending { idx, pos } to restore after React re-renders

  // Restore cursor synchronously after DOM commit so React's controlled-input
  // value normalization doesn't reset the cursor to the end.
  useLayoutEffect(() => {
    if (cursorRef.current == null) return;
    const { idx, pos } = cursorRef.current;
    cursorRef.current = null;
    refs.current[idx]?.setSelectionRange(pos, pos);
  });

  useImperativeHandle(ref, () => ({
    focus: (col, cursorEnd = true) => {
      const el = refs.current[Math.max(0, Math.min(4, col))];
      if (!el) return;
      el.focus();
      // When arriving from the right, land at the end.
      // When arriving from the left, land after the first char (position 1),
      // since position 0 is not a valid resting place in a non-empty tile.
      const pos = cursorEnd ? el.value.length : (el.value.length > 0 ? 1 : 0);
      el.setSelectionRange(pos, pos);
    },
  }), []);

  return (
    <div className={styles.slots}>
      {yellow.map((letters, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          className={`${styles.tile} ${styles.yellowTile} ${letters.length > 0 ? styles.yellowFilled : ''}`}
          maxLength={4}
          value={letters.join('').toUpperCase()}
          onChange={e => {
            const pos   = e.target.selectionStart;
            const chars = [...new Set(e.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase())];
            const next  = chars.slice(0, 4);
            setYellow(i, next);
            cursorRef.current = { idx: i, pos: Math.min(pos, next.length) };
          }}
          onSelect={e => {
            // Invariant: collapsed cursor never sits at position 0 in a non-empty tile.
            // This removes the "duplicate position" between end-of-tile-N and start-of-tile-N+1.
            // Range selections (selectionStart !== selectionEnd) are left alone.
            const el = e.target;
            if (el.selectionStart === 0 && el.selectionEnd === 0 && el.value.length > 0) {
              el.setSelectionRange(1, 1);
            }
          }}
          onKeyDown={e => {
            const { selectionStart, selectionEnd, value } = e.target;
            const hasSelection = selectionStart !== selectionEnd;

            if (e.key === 'ArrowLeft' && !hasSelection && selectionStart <= 1) {
              e.preventDefault();
              if (i > 0) {
                const el = refs.current[i - 1];
                el?.focus();
                if (el) { const len = el.value.length; el.setSelectionRange(len, len); }
              }
            }
            if (e.key === 'ArrowRight' && !hasSelection && selectionEnd >= value.length) {
              e.preventDefault();
              if (i < 4) {
                const el = refs.current[i + 1];
                el?.focus();
                if (el) {
                  const pos = el.value.length > 0 ? 1 : 0;
                  el.setSelectionRange(pos, pos);
                }
              }
            }
            if (e.key === 'Backspace' && value === '' && i > 0) {
              const el = refs.current[i - 1];
              el?.focus();
              if (el) { const len = el.value.length; el.setSelectionRange(len, len); }
            }
            if (e.key === ' ') {
              e.preventDefault();
              if (i < 4) {
                const el = refs.current[i + 1];
                el?.focus();
                if (el) { const len = el.value.length; el.setSelectionRange(len, len); }
              }
            }
            if (e.key === 'ArrowUp')   { e.preventDefault(); onUp?.(i); }
            if (e.key === 'ArrowDown') { e.preventDefault(); onDown?.(i); }
          }}
        />
      ))}
    </div>
  );
});

// Threshold below which we also show non-answer valid guesses matching constraints.
const NON_ANSWER_THRESHOLD = 8;
// Max total suggestions displayed (matches the worker's internal cap).
const SUGGESTION_CAP = 6;

function Suggestions() {
  const remainingWords = useConstraintStore(s => s.remainingWords);
  const constraints    = useConstraintStore(s => s.constraints);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]         = useState(false);
  const workerRef = useRef(null);
  const reqRef    = useRef(0);

  useEffect(() => {
    workerRef.current = new BrowserSuggestionWorker();
    return () => { workerRef.current?.terminate(); workerRef.current = null; };
  }, []);

  const nonAnswerMatches = useMemo(() => {
    if (remainingWords.length === 0 || remainingWords.length > NON_ANSWER_THRESHOLD) return [];
    return WORDS.filter(w => !ANSWERS_SET.has(w) && constraints.matches(w));
  }, [remainingWords, constraints]);

  useEffect(() => {
    if (!workerRef.current || remainingWords.length === 0 || remainingWords.length === ANSWERS.length) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const id = ++reqRef.current;
    setLoading(true);
    // Don't clear suggestions here — keep showing old ones (dimmed) while computing
    // so the layout doesn't collapse and then re-expand.
    workerRef.current.compute(remainingWords, null).then(({ words }) => {
      if (reqRef.current === id) { setSuggestions(words); setLoading(false); }
    }).catch(() => {
      if (reqRef.current === id) setLoading(false);
    });
  }, [remainingWords]);

  if (remainingWords.length === ANSWERS.length) {
    return <p className={styles.hint}>Enter constraints above to filter words</p>;
  }
  if (remainingWords.length === 0) {
    return <p className={styles.noMatch}>No words match these constraints</p>;
  }

  return (
    <div className={styles.suggestions}>
      <span className={styles.suggLabel}>Suggestions</span>
      <div className={styles.suggWords}>
        {loading && suggestions.length === 0
          ? <span className={styles.loading}>…</span>
          : suggestions.map(w => (
              <span key={w} className={`${styles.suggWord} ${loading ? styles.suggWordStale : ''}`}>{w}</span>
            ))
        }
        {nonAnswerMatches.slice(0, Math.max(0, SUGGESTION_CAP - suggestions.length)).map(w => (
          <span key={w} className={styles.suggWordNonAnswer}>{w}</span>
        ))}
      </div>
    </div>
  );
}

export function ConstraintEditor({ defaultShowSuggestions = true, showSuggestionsToggle = false }) {
  const unplaced    = useConstraintStore(s => s.unplaced);
  const gray        = useConstraintStore(s => s.gray);
  const remaining   = useConstraintStore(s => s.remainingWords.length);
  const setUnplaced = useConstraintStore(s => s.setUnplaced);
  const setGray     = useConstraintStore(s => s.setGray);
  const clear       = useConstraintStore(s => s.clear);

  const [showSuggestions, setShowSuggestions] = useState(defaultShowSuggestions);

  const greenRef    = useRef(null);
  const yellowRef   = useRef(null);
  const unplacedRef = useRef(null);
  const grayRef     = useRef(null);

  // rowIdx: 0=green, 1=yellow, 2=unplaced, 3=gray
  const focusRow = (rowIdx, col = 0) => {
    if (rowIdx === 0) greenRef.current?.focus(col);
    else if (rowIdx === 1) yellowRef.current?.focus(col);
    else if (rowIdx === 2) unplacedRef.current?.focus();
    else if (rowIdx === 3) grayRef.current?.focus();
  };

  return (
    <div className={styles.editor}>

      {/* Position number header */}
      <div /> {/* label column spacer */}
      <div className={styles.posNumbers}>
        {[1, 2, 3, 4, 5].map(n => <span key={n} className={styles.posNum}>{n}</span>)}
      </div>

      <span className={styles.label}>Green</span>
      <GreenRow
        ref={greenRef}
        onDown={col => focusRow(1, col)}
      />

      <span className={styles.label}>Not&nbsp;at</span>
      <YellowRow
        ref={yellowRef}
        onUp={col => focusRow(0, col)}
        onDown={col => focusRow(2, col)}
      />

      <span className={styles.label}>Unplaced</span>
      <input
        ref={unplacedRef}
        className={styles.textInput}
        placeholder="e.g. AAE (two A's + one E)"
        value={unplaced.join('').toUpperCase()}
        onChange={e => setUnplaced([...e.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase()])}
        onKeyDown={e => {
          if (e.key === 'ArrowUp')   { e.preventDefault(); focusRow(1, 0); }
          if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(3, 0); }
        }}
      />

      <span className={styles.label}>Gray</span>
      <input
        ref={grayRef}
        className={styles.textInput}
        placeholder="e.g. SRT"
        value={[...new Set(gray)].join('').toUpperCase()}
        onChange={e => setGray([...new Set(e.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase())])}
        onKeyDown={e => {
          if (e.key === 'ArrowUp') { e.preventDefault(); focusRow(2, 0); }
        }}
      />

      <div className={styles.below}>
        <div className={styles.footer}>
          <span className={styles.remaining}>{remaining.toLocaleString()} {remaining === 1 ? 'word' : 'words'} remaining</span>
          {showSuggestionsToggle && (
            <button className={styles.clearBtn} onClick={() => setShowSuggestions(s => !s)}>
              {showSuggestions ? 'Hide suggestions' : 'Suggestions'}
            </button>
          )}
          <button className={styles.clearBtn} onClick={clear}>Clear</button>
        </div>
        {showSuggestions && <Suggestions />}
      </div>

    </div>
  );
}
