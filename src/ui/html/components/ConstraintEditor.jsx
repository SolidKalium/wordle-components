import { useEffect, useRef, useState } from 'react';
import { ANSWERS } from '../../../lib/words.gen.mjs';
import { useConstraintStore } from '../stores/constraintStore.js';
import { BrowserSuggestionWorker } from '../workers/BrowserSuggestionWorker.mjs';
import styles from './ConstraintEditor.module.css';

function GreenRow() {
  const green    = useConstraintStore(s => s.green);
  const setGreen = useConstraintStore(s => s.setGreen);
  const refs     = useRef(Array.from({ length: 5 }, () => null));

  return (
    <div className={styles.slots}>
      {green.map((letter, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          className={`${styles.tile} ${styles.greenTile} ${letter ? styles.greenFilled : ''}`}
          value={letter?.toUpperCase() ?? ''}
          maxLength={2}
          onChange={e => {
            const ch = e.target.value.replace(/[^a-zA-Z]/g, '').slice(-1).toLowerCase() || null;
            setGreen(i, ch);
            if (ch && i < 4) refs.current[i + 1]?.focus();
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !letter && i > 0) {
              setGreen(i - 1, null);
              refs.current[i - 1]?.focus();
            }
            if (e.key === 'ArrowLeft'  && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < 4) refs.current[i + 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}

function YellowRow() {
  const yellow    = useConstraintStore(s => s.yellow);
  const setYellow = useConstraintStore(s => s.setYellow);

  return (
    <div className={styles.slots}>
      {yellow.map((letters, i) => (
        <input
          key={i}
          className={`${styles.tile} ${styles.yellowTile} ${letters.length > 0 ? styles.yellowFilled : ''}`}
          maxLength={4}
          value={letters.join('').toUpperCase()}
          onChange={e => {
            const chars = [...new Set(e.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase())];
            setYellow(i, chars.slice(0, 4));
          }}
        />
      ))}
    </div>
  );
}

function Suggestions() {
  const remainingWords = useConstraintStore(s => s.remainingWords);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]         = useState(false);
  const workerRef = useRef(null);
  const reqRef    = useRef(0);

  useEffect(() => {
    workerRef.current = new BrowserSuggestionWorker();
    return () => { workerRef.current?.terminate(); workerRef.current = null; };
  }, []);

  useEffect(() => {
    if (!workerRef.current || remainingWords.length === 0 || remainingWords.length === ANSWERS.length) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const id = ++reqRef.current;
    setLoading(true);
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
        {loading
          ? <span className={styles.loading}>…</span>
          : suggestions.map(w => <span key={w} className={styles.suggWord}>{w}</span>)
        }
      </div>
    </div>
  );
}

export function ConstraintEditor() {
  const unplaced    = useConstraintStore(s => s.unplaced);
  const gray        = useConstraintStore(s => s.gray);
  const remaining   = useConstraintStore(s => s.remainingWords.length);
  const setUnplaced = useConstraintStore(s => s.setUnplaced);
  const setGray     = useConstraintStore(s => s.setGray);
  const clear       = useConstraintStore(s => s.clear);

  return (
    <div className={styles.editor}>

      {/* Position number header */}
      <div /> {/* label column spacer */}
      <div className={styles.posNumbers}>
        {[1, 2, 3, 4, 5].map(n => <span key={n} className={styles.posNum}>{n}</span>)}
      </div>

      <span className={styles.label}>Green</span>
      <GreenRow />

      <span className={styles.label}>Not&nbsp;at</span>
      <YellowRow />

      <span className={styles.label}>Unplaced</span>
      <input
        className={styles.textInput}
        placeholder="e.g. AAE (two A's + one E)"
        value={unplaced.join('').toUpperCase()}
        onChange={e => setUnplaced([...e.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase()])}
      />

      <span className={styles.label}>Gray</span>
      <input
        className={styles.textInput}
        placeholder="e.g. SRT"
        value={[...new Set(gray)].join('').toUpperCase()}
        onChange={e => setGray([...new Set(e.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase())])}
      />

      <div className={styles.below}>
        <div className={styles.footer}>
          <span className={styles.remaining}>{remaining.toLocaleString()} words remaining</span>
          <button className={styles.clearBtn} onClick={clear}>Clear</button>
        </div>
        <Suggestions />
      </div>

    </div>
  );
}
