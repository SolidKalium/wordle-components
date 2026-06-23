import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { BruteForceGenerator } from '../../../lib/bruteForce.mjs';
import { useConstraints } from '../stores/useConstraints.js';
import styles from './BruteForceList.module.css';

function formatApprox(n) {
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000)    return `~${Math.round(n / 1_000)}k`;
  if (n >= 1_000)     return `~${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

function toRows(flat, n) {
  const rows = [];
  for (let i = 0; i < flat.length; i += n) rows.push(flat.slice(i, i + n));
  return rows;
}

// Defined at module scope so Virtuoso never remounts the scroller on re-render.
const VirtuosoScroller = React.forwardRef(({ style, ...props }, ref) => (
  <div
    ref={ref}
    style={{ ...style, overflowX: 'hidden' }}
    className={styles.scroller}
    {...props}
  />
));
VirtuosoScroller.displayName = 'VirtuosoScroller';

const NoOptions = () => <span className={styles.empty}>no options</span>;

const INITIAL_ROWS = 16;
const CHUNK_ROWS   = 24;

// Rendered width of one word: 5 monospace chars at 13px + 0.08em letter-spacing ≈ 44px.
const WORD_PX = 44;
const GAP_PX  = 16;
// 36 = left-padding(20) + right-padding(16)
const PANEL_PADDING_PX = 36;
const SCROLLBAR_GUTTER_PX = 12;

export function BruteForceList({ wordsPerLine = 3 }) {
  const constraints = useConstraints();

  const [rows,      setRows]      = useState([]);
  const [approx,    setApprox]    = useState(0);
  const [exhausted, setExhausted] = useState(false);

  const genRef  = useRef(null);
  const nextRef = useRef(null);

  const loadChunk = useCallback(() => {
    if (!genRef.current || nextRef.current === null) return;
    const { items, nextCombo } = genRef.current.getPage(
      nextRef.current,
      CHUNK_ROWS * wordsPerLine,
    );
    nextRef.current = nextCombo;
    if (nextCombo === null) setExhausted(true);
    if (items.length > 0) setRows(prev => [...prev, ...toRows(items, wordsPerLine)]);
  }, [wordsPerLine]);

  useEffect(() => {
    const gen = new BruteForceGenerator(constraints);
    genRef.current  = gen;
    nextRef.current = gen.first();
    setApprox(gen.approxTotal());

    if (nextRef.current === null) {
      setRows([]);
      setExhausted(true);
      return;
    }

    setExhausted(false);
    const { items, nextCombo } = gen.getPage(nextRef.current, INITIAL_ROWS * wordsPerLine);
    nextRef.current = nextCombo;
    setRows(toRows(items, wordsPerLine));
  }, [constraints, wordsPerLine]);

  const panelMinWidth =
    wordsPerLine * WORD_PX + (wordsPerLine - 1) * GAP_PX + SCROLLBAR_GUTTER_PX;

  return (
    <div className={styles.panel} style={{ minWidth: panelMinWidth }}>
      <Virtuoso
        style={{ height: 220 }}
        data={rows}
        itemContent={(_, row) => (
          <div className={styles.row}>
            {row.map((w, j) => <span key={j} className={styles.word}>{w}</span>)}
          </div>
        )}
        endReached={exhausted ? undefined : loadChunk}
        increaseViewportBy={{ top: 0, bottom: 300 }}
        components={{
          Scroller: VirtuosoScroller,
          EmptyPlaceholder: exhausted ? NoOptions : undefined,
        }}
      />
      <span className={styles.count}>{formatApprox(approx)} {approx === 1 ? 'option' : 'options'}</span>
    </div>
  );
}
