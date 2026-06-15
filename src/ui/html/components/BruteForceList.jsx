import { useEffect, useState } from 'react';
import { BruteForceGenerator } from '../../../lib/bruteForce.mjs';
import { useConstraintStore } from '../stores/constraintStore.js';
import styles from './BruteForceList.module.css';

const PAGE_SIZE = 8;

function formatApprox(n) {
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000)     return `~${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${n}`;
}

function makeInitialState(constraints) {
  const gen   = new BruteForceGenerator(constraints);
  const first = gen.first();
  const { items, nextCombo } = gen.getPage(first, PAGE_SIZE);
  return { gen, pageStack: [first], items, nextCombo };
}

export function BruteForceList() {
  const constraints = useConstraintStore(s => s.constraints);

  const [state, setState] = useState(() => makeInitialState(constraints));
  const { gen, pageStack, items, nextCombo } = state;

  // Rebuild when constraints change.
  useEffect(() => {
    setState(makeInitialState(constraints));
  }, [constraints]);

  const goNext = () => {
    if (!nextCombo) return;
    const { items: newItems, nextCombo: newNext } = gen.getPage(nextCombo, PAGE_SIZE);
    setState(s => ({ ...s, pageStack: [...s.pageStack, nextCombo], items: newItems, nextCombo: newNext }));
  };

  const goPrev = () => {
    if (pageStack.length <= 1) return;
    const newStack = pageStack.slice(0, -1);
    const prevStart = newStack[newStack.length - 1];
    const { items: newItems, nextCombo: newNext } = gen.getPage(prevStart, PAGE_SIZE);
    setState(s => ({ ...s, pageStack: newStack, items: newItems, nextCombo: newNext }));
  };

  const approx  = gen.approxTotal();
  const isFirst = pageStack.length <= 1;
  const isLast  = !nextCombo;

  return (
    <div className={styles.panel}>
      <div className={styles.list}>
        {items.map((w, i) => <span key={i} className={styles.word}>{w}</span>)}
        {Array.from({ length: PAGE_SIZE - items.length }, (_, i) => (
          <span key={`pad-${i}`} className={styles.pad} />
        ))}
      </div>
      <div className={styles.nav}>
        <button className={styles.btn} onClick={goPrev} disabled={isFirst}>←</button>
        <button className={styles.btn} onClick={goNext} disabled={isLast}>→</button>
      </div>
      <span className={styles.count}>{formatApprox(approx)} options</span>
    </div>
  );
}
