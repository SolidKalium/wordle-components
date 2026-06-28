import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { BruteForceGenerator } from '../../../lib/bruteForce.mjs';
import { useConstraints } from '../stores/useConstraints.js';
import styles from './BruteForceList.module.css';

function formatCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000)    return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
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

const NoOptions = () => <div className={styles.empty}>No options</div>;

// Rendered width of one word: 5 monospace chars at 13px + 0.08em letter-spacing ≈ 44px.
const WORD_PX = 44;
const GAP_PX  = 16;
// 36 = left-padding(20) + right-padding(16)
const PANEL_PADDING_PX = 36;
const SCROLLBAR_GUTTER_PX = 12;

export function BruteForceList({ wordsPerLine = 3 }) {
  const constraints = useConstraints();

  const [total, setTotal]       = useState(0);
  const [revision, setRevision] = useState(0);
  const genRef = useRef(null);

  // revision forces Virtuoso to remount (via key) on every constraints change,
  // not just ones where the total happens to change — otherwise an edit that
  // swaps which words match without changing the count wouldn't re-fetch
  // already-rendered rows, and the scroll position wouldn't reset to a list
  // that's actually unrelated to where the user had scrolled to before.
  useEffect(() => {
    genRef.current = new BruteForceGenerator(constraints);
    setTotal(genRef.current.exactTotal());
    setRevision(r => r + 1);
  }, [constraints]);

  const rowCount = Math.ceil(total / wordsPerLine);

  // Rows are computed on demand via nth() rather than loaded incrementally —
  // it's cheap regardless of index, so the scrollbar can be sized to the real
  // total and jumping to any position (drag, page up/down) is just as fast as
  // scrolling sequentially.
  const itemContent = useCallback(rowIndex => {
    const gen   = genRef.current;
    const start = rowIndex * wordsPerLine;
    const end   = Math.min(start + wordsPerLine, total);
    const words = [];
    for (let i = start; i < end; i++) words.push(gen.nth(i));

    return (
      <div className={styles.row}>
        {words.map((w, j) => <span key={j} className={styles.word}>{w}</span>)}
      </div>
    );
  }, [wordsPerLine, total]);

  const panelMinWidth =
    wordsPerLine * WORD_PX + (wordsPerLine - 1) * GAP_PX + SCROLLBAR_GUTTER_PX;

  return (
    <div className={styles.panel} style={{ minWidth: panelMinWidth }}>
      <Virtuoso
        key={revision}
        style={{ height: 220 }}
        totalCount={rowCount}
        itemContent={itemContent}
        increaseViewportBy={{ top: 0, bottom: 300 }}
        components={{
          Scroller: VirtuosoScroller,
          EmptyPlaceholder: rowCount === 0 ? NoOptions : undefined,
        }}
      />
      <span className={styles.count}>{formatCount(total)} {total === 1 ? 'option' : 'options'}</span>
    </div>
  );
}
