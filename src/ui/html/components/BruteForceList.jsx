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

// Virtuoso reports its landing range via one or more rangeChanged calls while a
// remount settles (an initial estimate, then a corrected one) — rangeChanged calls
// in this window after a remount are our own repositioning settling, not a user
// scroll, so they're ignored for anchor-tracking purposes.
const ANCHOR_SETTLE_MS = 150;

export function BruteForceList({ wordsPerLine = 3 }) {
  const constraints = useConstraints();

  const [total, setTotal]       = useState(0);
  const [revision, setRevision] = useState(0);
  const genRef          = useRef(null);
  const anchorWordRef    = useRef(null); // first word of the topmost visible row
  const anchorRowRef     = useRef(0);    // row to scroll to on the next mount
  const lastRemountAtRef = useRef(0);    // Date.now() of the most recent remount, for the settle window

  // revision forces Virtuoso to remount (via key) on every constraints change,
  // not just ones where the total happens to change — otherwise an edit that
  // swaps which words match without changing the count wouldn't re-fetch
  // already-rendered rows.
  //
  // Before swapping in the new generator, re-rank the word that was previously
  // topmost so the remount can start at wherever that word (or the next valid
  // one after it, via rankOf's insertion-point behavior) ends up — otherwise
  // every keystroke would fling a deep scroll position back to the top of a
  // list that's mostly still the same.
  useEffect(() => {
    const gen      = new BruteForceGenerator(constraints);
    const newTotal = gen.exactTotal();
    const rowCount = Math.ceil(newTotal / wordsPerLine);

    anchorRowRef.current = anchorWordRef.current === null
      ? 0
      : Math.min(Math.floor(gen.rankOf(anchorWordRef.current) / wordsPerLine), Math.max(rowCount - 1, 0));

    genRef.current = gen;
    lastRemountAtRef.current = Date.now();
    setTotal(newTotal);
    setRevision(r => r + 1);
  }, [constraints, wordsPerLine]);

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

  // Tracks the topmost visible row on every real scroll so the next constraints
  // change has something current to re-anchor to. Calls within ANCHOR_SETTLE_MS
  // of our own remount are our own repositioning settling, not a user scroll —
  // otherwise that system-driven repositioning would overwrite the anchor, and
  // e.g. typing a character then immediately deleting it would re-derive the
  // scroll position from the narrowed list instead of restoring the original one.
  const handleRangeChanged = useCallback(({ startIndex }) => {
    if (Date.now() - lastRemountAtRef.current < ANCHOR_SETTLE_MS) return;
    const gen = genRef.current;
    if (!gen) return;
    const w = gen.nth(startIndex * wordsPerLine);
    if (w !== null) anchorWordRef.current = w;
  }, [wordsPerLine]);

  const panelMinWidth =
    wordsPerLine * WORD_PX + (wordsPerLine - 1) * GAP_PX + SCROLLBAR_GUTTER_PX;

  return (
    <div className={styles.panel} style={{ minWidth: panelMinWidth }}>
      <Virtuoso
        key={revision}
        style={{ height: 220 }}
        totalCount={rowCount}
        itemContent={itemContent}
        initialTopMostItemIndex={anchorRowRef.current}
        rangeChanged={handleRangeChanged}
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
