import { useCallback, useEffect, useRef, useState } from 'react';
import { BruteForceGenerator } from '../../../lib/bruteForce.mjs';
import { useConstraintStore } from '../stores/constraintStore.js';
import styles from './BruteForceList.module.css';

function formatApprox(n) {
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000)    return `~${Math.round(n / 1_000)}k`;
  if (n >= 1_000)     return `~${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

export function BruteForceList({ wordsPerLine = 3 }) {
  const constraints = useConstraintStore(s => s.constraints);

  const [items,     setItems]     = useState([]);
  const [approx,    setApprox]    = useState(0);
  const [exhausted, setExhausted] = useState(false);

  const genRef       = useRef(null);
  const nextRef      = useRef(null);
  const loadingRef   = useRef(false);
  const containerRef = useRef(null);

  // 3 rows per chunk, as a natural preload unit.
  const chunkSize = useRef(3 * wordsPerLine);
  chunkSize.current = 3 * wordsPerLine;

  const loadChunk = useCallback(() => {
    if (loadingRef.current || !genRef.current || nextRef.current === null) return;
    loadingRef.current = true;
    const { items: chunk, nextCombo } = genRef.current.getPage(nextRef.current, chunkSize.current);
    nextRef.current = nextCombo;
    if (nextCombo === null) setExhausted(true);
    setItems(prev => [...prev, ...chunk]);
  }, []); // stable — reads only refs

  // After each items commit: clear the loading gate, then keep filling until
  // the container actually overflows. This handles the case where the initial
  // batch doesn't create any scrollable range (no onScroll ever fires).
  useEffect(() => {
    loadingRef.current = false;
    const el = containerRef.current;
    if (el && !exhausted && el.scrollHeight <= el.clientHeight + 1) {
      loadChunk();
    }
  }, [items, exhausted, loadChunk]);

  // Rebuild generator on constraint change.
  useEffect(() => {
    const gen = new BruteForceGenerator(constraints);
    genRef.current     = gen;
    nextRef.current    = gen.first();
    loadingRef.current = false;
    setApprox(gen.approxTotal());

    if (nextRef.current === null) {
      setItems([]);
      setExhausted(true);
      return;
    }

    setExhausted(false);
    const { items: chunk, nextCombo } = gen.getPage(nextRef.current, chunkSize.current);
    nextRef.current = nextCombo;
    setItems(chunk);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [constraints]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preload when within ~3 rows of the bottom.
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || exhausted) return;
    const rowHeight = el.scrollHeight / Math.max(1, items.length / wordsPerLine);
    if (el.scrollHeight - el.scrollTop - el.clientHeight < rowHeight * 3) {
      loadChunk();
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.scroll} ref={containerRef} onScroll={handleScroll}>
        <div className={styles.grid} style={{ '--cols': wordsPerLine }}>
          {items.map((w, i) => <span key={i} className={styles.word}>{w}</span>)}
          {exhausted && items.length === 0 && (
            <span className={styles.empty}>no options</span>
          )}
        </div>
      </div>
      <span className={styles.count}>{formatApprox(approx)} options</span>
    </div>
  );
}
