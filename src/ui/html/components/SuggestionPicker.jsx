import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore.js';
import { BrowserSuggestionWorker } from '../workers/BrowserSuggestionWorker.mjs';
import styles from './SuggestionPicker.module.css';

export function SuggestionPicker() {
  const remainingWords = useGameStore(s => s.remainingWords);
  const isOver         = useGameStore(s => s.isOver);
  const makeMove       = useGameStore(s => s.makeMove);

  const workerRef = useRef(null);
  const reqRef    = useRef(0);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    workerRef.current = new BrowserSuggestionWorker();
    return () => { workerRef.current?.terminate(); workerRef.current = null; };
  }, []);

  useEffect(() => {
    if (isOver) { setSuggestions([]); setLoading(false); return; }
    if (!workerRef.current || remainingWords.length === 0) { setSuggestions([]); return; }

    const id = ++reqRef.current;
    setLoading(true);
    workerRef.current.compute(remainingWords, null).then(({ words }) => {
      if (reqRef.current === id) {
        setSuggestions(words);
        setLoading(false);
      }
    }).catch(() => {
      if (reqRef.current === id) setLoading(false);
    });
  }, [remainingWords, isOver]);

  if (isOver) return null;

  return (
    <div className={styles.picker}>
      <span className={styles.label}>Suggestions</span>
      <div className={styles.words}>
        {loading
          ? <span className={styles.loading}>…</span>
          : suggestions.map(word => (
              <button
                key={word}
                className={styles.word}
                onClick={() => makeMove(word)}
              >
                {word}
              </button>
            ))
        }
      </div>
    </div>
  );
}
