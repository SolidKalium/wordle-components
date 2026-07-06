import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BruteForceGenerator } from '../../../lib/bruteForce.mjs';
import { useConstraints } from '../stores/useConstraints.js';
import styles from './BruteForceList.module.css';

function formatCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000)    return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

const NoOptions = () => <div className={styles.empty}>No options</div>;

// Rendered width of one word: 5 monospace chars at 13px + 0.08em letter-spacing ≈ 44px.
const WORD_PX = 44;
const GAP_PX  = 16;
const SCROLLBAR_GUTTER_PX = 12;
const ROW_HEIGHT_PX = 24;
const VIEWPORT_HEIGHT_PX = 220;
const MAX_SCROLL_HEIGHT_PX = 8_000_000;
const OVERSCAN_ROWS = 8;
const SEEK_JUMP_THRESHOLD_PX = VIEWPORT_HEIGHT_PX * 2;
const SEEK_SETTLE_MS = 100;

const ANCHOR_SETTLE_MS = 150;

// Browsers cap the height of a scrollable element (WebKit is roughly 2^24 px).
// Map an arbitrarily tall logical list onto a safely bounded physical spacer.
export function createScrollMetrics(rowCount, viewportHeight = VIEWPORT_HEIGHT_PX) {
  const logicalHeight = rowCount * ROW_HEIGHT_PX;
  const physicalHeight = Math.min(logicalHeight, MAX_SCROLL_HEIGHT_PX);
  const logicalMax = Math.max(0, logicalHeight - viewportHeight);
  const physicalMax = Math.max(0, physicalHeight - viewportHeight);
  const scale = physicalMax > 0 ? logicalMax / physicalMax : 1;
  return { logicalHeight, physicalHeight, logicalMax, physicalMax, scale };
}

export function jumpRowFor(gen, target, wordsPerLine) {
  const rank = gen.rankOf(target);
  const exact = gen.nth(rank) === target;
  const contextualIndex = exact ? rank : Math.max(0, rank - 1);
  return Math.floor(contextualIndex / wordsPerLine);
}

export function BruteForceList({ wordsPerLine = 3 }) {
  const constraints = useConstraints();
  const jumpInputId = useId();

  const [total, setTotal]       = useState(0);
  const [revision, setRevision] = useState(0);
  const [physicalScrollTop, setPhysicalScrollTop] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [jumpExpanded, setJumpExpanded] = useState(false);
  const [jumpValue, setJumpValue] = useState('');
  const genRef          = useRef(null);
  const scrollerRef     = useRef(null);
  const seekOverlayRef  = useRef(null);
  const seekWordRef     = useRef(null);
  const lastLogicalScrollTopRef = useRef(0);
  const seekingRef      = useRef(false);
  const seekTimerRef    = useRef(null);
  const jumpControlRef  = useRef(null);
  const jumpInputRef    = useRef(null);
  const jumpTriggerRef  = useRef(null);
  const returnJumpFocusRef = useRef(false);
  const anchorWordRef    = useRef(null); // first word of the topmost visible row
  const anchorRowRef     = useRef(0);    // row to scroll to on the next mount
  const lastRemountAtRef = useRef(0);    // Date.now() of the most recent remount, for the settle window

  // Before swapping in the new generator, re-rank the word that was previously
  // topmost so the list can start at wherever that word (or the next valid
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
    setTotal(newTotal);
    setRevision(r => r + 1);
  }, [constraints, wordsPerLine]);

  const rowCount = Math.ceil(total / wordsPerLine);
  const metrics = useMemo(() => createScrollMetrics(rowCount), [rowCount]);

  useEffect(() => () => clearTimeout(seekTimerRef.current), []);

  useLayoutEffect(() => {
    if (jumpExpanded) {
      jumpInputRef.current?.focus();
      jumpInputRef.current?.select();
    } else if (returnJumpFocusRef.current) {
      returnJumpFocusRef.current = false;
      jumpTriggerRef.current?.focus();
    }
  }, [jumpExpanded]);

  // Reposition after a constraint change. The settle window preserves the old
  // anchor long enough for a quick edit-and-undo sequence to restore it.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const logicalTop = Math.min(anchorRowRef.current * ROW_HEIGHT_PX, metrics.logicalMax);
    const physicalTop = metrics.scale > 0 ? logicalTop / metrics.scale : 0;
    lastRemountAtRef.current = Date.now();
    lastLogicalScrollTopRef.current = logicalTop;
    seekingRef.current = false;
    clearTimeout(seekTimerRef.current);
    setIsSeeking(false);
    scroller.scrollTop = physicalTop;
    setPhysicalScrollTop(physicalTop);
  }, [metrics, revision]);

  const logicalScrollTop = Math.min(physicalScrollTop * metrics.scale, metrics.logicalMax);
  const firstVisibleRow = Math.min(
    Math.floor(logicalScrollTop / ROW_HEIGHT_PX),
    Math.max(rowCount - 1, 0),
  );
  const firstRenderedRow = Math.max(0, firstVisibleRow - OVERSCAN_ROWS);
  const visibleRows = Math.ceil(VIEWPORT_HEIGHT_PX / ROW_HEIGHT_PX);
  const lastRenderedRow = Math.min(
    rowCount - 1,
    firstVisibleRow + visibleRows + OVERSCAN_ROWS,
  );
  const renderTop = physicalScrollTop
    + firstRenderedRow * ROW_HEIGHT_PX
    - logicalScrollTop;

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

  const updateAnchor = useCallback(startIndex => {
    if (Date.now() - lastRemountAtRef.current < ANCHOR_SETTLE_MS) return;
    const gen = genRef.current;
    if (!gen) return;
    const w = gen.nth(startIndex * wordsPerLine);
    if (w !== null) anchorWordRef.current = w;
  }, [wordsPerLine]);

  const handleScroll = useCallback(event => {
    const nextPhysicalTop = event.currentTarget.scrollTop;
    setPhysicalScrollTop(nextPhysicalTop);
    const logicalTop = Math.min(nextPhysicalTop * metrics.scale, metrics.logicalMax);
    const jump = Math.abs(logicalTop - lastLogicalScrollTopRef.current);
    lastLogicalScrollTopRef.current = logicalTop;

    if (jump > SEEK_JUMP_THRESHOLD_PX || seekingRef.current) {
      seekingRef.current = true;
      const rowIndex = Math.floor(logicalTop / ROW_HEIGHT_PX);
      const word = genRef.current?.nth(rowIndex * wordsPerLine);
      if (seekWordRef.current) seekWordRef.current.textContent = word ?? '';
      // Show synchronously; waiting for React here can leave the native scroll
      // viewport ahead of both the real rows and their loading indicator.
      seekOverlayRef.current?.classList.add(styles.visible);
      setIsSeeking(true);
      clearTimeout(seekTimerRef.current);
      seekTimerRef.current = setTimeout(() => {
        seekingRef.current = false;
        setIsSeeking(false);
      }, SEEK_SETTLE_MS);
    }

    updateAnchor(Math.floor(logicalTop / ROW_HEIGHT_PX));
  }, [metrics, updateAnchor, wordsPerLine]);

  // A compressed scrollbar would otherwise amplify wheel deltas by `scale`.
  // Convert wheel motion back to logical pixels so ordinary scrolling remains
  // row-for-row; dragging the thumb still spans the complete data set.
  const handleWheel = useCallback(event => {
    if (metrics.scale <= 1) return;
    event.preventDefault();
    const multiplier = event.deltaMode === 1
      ? ROW_HEIGHT_PX
      : event.deltaMode === 2 ? VIEWPORT_HEIGHT_PX : 1;
    scrollerRef.current.scrollTop += event.deltaY * multiplier / metrics.scale;
  }, [metrics.scale]);

  const scrollByLogicalPixels = useCallback(delta => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop += delta / metrics.scale;
  }, [metrics.scale]);

  const scrollToLogicalPixel = useCallback(position => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const logicalTop = Math.max(0, Math.min(position, metrics.logicalMax));
    scroller.scrollTop = logicalTop / metrics.scale;
  }, [metrics.logicalMax, metrics.scale]);

  const handleKeyDown = useCallback(event => {
    const largeStep = VIEWPORT_HEIGHT_PX - ROW_HEIGHT_PX;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (event.metaKey) scrollToLogicalPixel(metrics.logicalMax);
      else scrollByLogicalPixels(event.altKey || event.shiftKey ? largeStep : ROW_HEIGHT_PX);
    }
    else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (event.metaKey) scrollToLogicalPixel(0);
      else scrollByLogicalPixels(event.altKey || event.shiftKey ? -largeStep : -ROW_HEIGHT_PX);
    }
    else if (event.key === 'PageDown') { event.preventDefault(); scrollByLogicalPixels(VIEWPORT_HEIGHT_PX); }
    else if (event.key === 'PageUp') { event.preventDefault(); scrollByLogicalPixels(-VIEWPORT_HEIGHT_PX); }
    else if (event.key === ' ' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      scrollByLogicalPixels(event.shiftKey ? -VIEWPORT_HEIGHT_PX : VIEWPORT_HEIGHT_PX);
    }
    else if (event.key === 'Home') { event.preventDefault(); scrollToLogicalPixel(0); }
    else if (event.key === 'End') { event.preventDefault(); scrollToLogicalPixel(metrics.logicalMax); }
  }, [metrics.logicalMax, scrollByLogicalPixels, scrollToLogicalPixel]);

  const closeJump = useCallback(() => {
    returnJumpFocusRef.current = true;
    setJumpExpanded(false);
  }, []);

  const performJump = useCallback(() => {
    if (!jumpValue || !genRef.current || rowCount === 0) return;
    const target = jumpValue.padEnd(5, 'a');
    const row = Math.min(jumpRowFor(genRef.current, target, wordsPerLine), rowCount - 1);
    scrollToLogicalPixel(row * ROW_HEIGHT_PX);
    closeJump();
  }, [closeJump, jumpValue, rowCount, scrollToLogicalPixel, wordsPerLine]);

  const renderedRows = [];
  if (!isSeeking) {
    for (let row = firstRenderedRow; row <= lastRenderedRow; row++) {
      renderedRows.push(<div key={`${revision}-${row}`}>{itemContent(row)}</div>);
    }
  }

  const skeletonRows = Array.from({ length: visibleRows }, (_, row) => (
    <div className={styles.skeletonRow} key={row} aria-hidden="true">
      {Array.from({ length: wordsPerLine }, (__, word) => (
        <span
          key={word}
          ref={row === 0 && word === 0 ? seekWordRef : undefined}
          className={row === 0 && word === 0 ? styles.seekWord : undefined}
        />
      ))}
    </div>
  ));

  const panelMinWidth =
    wordsPerLine * WORD_PX + (wordsPerLine - 1) * GAP_PX + SCROLLBAR_GUTTER_PX;

  return (
    <div className={styles.panel} style={{ minWidth: panelMinWidth }}>
      {rowCount === 0 ? <NoOptions /> : (
        <div
          ref={scrollerRef}
          className={styles.scroller}
          style={{ height: VIEWPORT_HEIGHT_PX }}
          tabIndex={0}
          role="region"
          aria-label="Generated letter combinations"
          aria-busy={isSeeking}
          onScroll={handleScroll}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
        >
          <div className={styles.scrollSpace} style={{ height: metrics.physicalHeight }}>
            <div
              ref={seekOverlayRef}
              className={`${styles.seekOverlay} ${isSeeking ? styles.visible : ''}`}
              aria-hidden="true"
            >
              {skeletonRows}
            </div>
            <div className={styles.renderWindow} style={{ transform: `translateY(${renderTop}px)` }}>
              {renderedRows}
            </div>
          </div>
        </div>
      )}
      <span className={styles.srOnly} role="status" aria-live="polite">
        {isSeeking ? 'Loading rows' : ''}
      </span>
      <div className={styles.footer}>
        <span className={styles.count}>{formatCount(total)} {total === 1 ? 'option' : 'options'}</span>
        <div
          ref={jumpControlRef}
          className={`${styles.jumpControl} ${jumpExpanded ? styles.jumpExpanded : ''}`}
          onBlur={event => {
            if (jumpExpanded && !event.currentTarget.contains(event.relatedTarget)) {
              setJumpExpanded(false);
            }
          }}
        >
          <button
            ref={jumpTriggerRef}
            type="button"
            className={styles.jumpTrigger}
            aria-expanded={jumpExpanded}
            aria-controls={jumpInputId}
            tabIndex={jumpExpanded ? -1 : 0}
            onClick={() => setJumpExpanded(value => !value)}
            disabled={rowCount === 0}
          >
            Jump to
          </button>
          <div className={styles.jumpEditor} aria-hidden={!jumpExpanded}>
            <input
              ref={jumpInputRef}
              id={jumpInputId}
              className={styles.jumpInput}
              value={jumpValue}
              maxLength={5}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-label="Word or prefix to jump to"
              tabIndex={jumpExpanded ? 0 : -1}
              onChange={event => setJumpValue(
                event.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, 5),
              )}
              onKeyDown={event => {
                if (event.key === 'Enter') { event.preventDefault(); performJump(); }
                else if (event.key === 'Escape') { event.preventDefault(); closeJump(); }
              }}
            />
            <button
              type="button"
              className={styles.jumpGo}
              tabIndex={jumpExpanded ? 0 : -1}
              disabled={!jumpValue}
              onClick={performJump}
            >
              Go
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
