import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore.js';
import { computePendingSlots } from '../../../lib/pendingWord.mjs';
import { MoveResult } from '../../../lib/game.mjs';
import { InputTiles } from './InputTiles.jsx';
import styles from './WordInput.module.css';

const ERROR_TEXT = {
  [MoveResult.WRONG_LENGTH]:   'Must be 5 letters',
  [MoveResult.NOT_IN_LIST]:    'Not in word list',
};

const EMPTY_BUFFER = [null, null, null, null, null];
const MAX_CURSOR = 4; // cursor stays on a tile (never off the right edge)

export function WordInput({ showPool = true }) {
  const makeMove    = useGameStore(s => s.makeMove);
  const isOver      = useGameStore(s => s.isOver);
  const constraints = useGameStore(s => s.constraints);
  const answer      = useGameStore(s => s.answer);
  const containerRef = useRef(null);

  const [buffer,   setBuffer]   = useState([...EMPTY_BUFFER]);
  const [cursor,   setCursor]   = useState(0);
  const [error,    setError]    = useState('');
  const [focused,  setFocused]  = useState(false);

  // Reset and refocus when a new game starts
  useEffect(() => {
    setBuffer([...EMPTY_BUFFER]);
    setCursor(0);
    setError('');
    containerRef.current?.focus();
  }, [answer]);

  const { slots, pool } = computePendingSlots(buffer, constraints, cursor);

  const submit = (buf) => {
    const word = buf.join('');
    const result = makeMove(word);
    if (result.valid) {
      setBuffer([...EMPTY_BUFFER]);
      setCursor(0);
      setError('');
    } else {
      setError(ERROR_TEXT[result.error] ?? result.detail ?? `Invalid (${result.error})`);
    }
  };

  const handleKeyDown = (e) => {
    if (isOver) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (buffer.every(c => c !== null)) submit(buffer);
        return;

      case 'Escape':
        containerRef.current?.blur();
        return;

      case 'Tab': {
        if (e.shiftKey) break; // let Shift-Tab propagate for backwards navigation
        const next = buffer.map((c, i) => c ?? constraints.known[i] ?? null);
        const wouldChange = next.some((c, i) => c !== buffer[i]);
        if (!wouldChange) break; // nothing to autofill — let Tab move focus normally
        e.preventDefault();
        const firstEmpty = next.findIndex(c => c === null);
        setBuffer(next);
        setCursor(firstEmpty === -1 ? MAX_CURSOR : firstEmpty);
        return;
      }

      case 'Backspace':
        e.preventDefault();
        if (cursor > 0) {
          const next = [...buffer];
          next[cursor - 1] = null;
          setBuffer(next);
          setCursor(c => c - 1);
          setError('');
        }
        return;

      case 'ArrowLeft':
        e.preventDefault();
        setCursor(c => Math.max(0, c - 1));
        return;

      case 'ArrowRight':
        e.preventDefault();
        setCursor(c => Math.min(MAX_CURSOR, c + 1));
        return;

      default:
        if (e.key.length === 1 && /[a-zA-Z]/.test(e.key) && cursor <= MAX_CURSOR) {
          e.preventDefault();
          const next = [...buffer];
          next[cursor] = e.key.toLowerCase();
          setBuffer(next);
          setCursor(c => Math.min(MAX_CURSOR, c + 1));
          setError('');
        }
    }
  };

  if (isOver) return null;

  return (
    <div
      ref={containerRef}
      className={styles.wrapper}
      tabIndex={0}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={handleKeyDown}
      onClick={() => containerRef.current?.focus()}
    >
      <InputTiles slots={slots} focused={focused} />
      {showPool && pool.length > 0 && (
        <div className={styles.pool}>
          {pool.map(({ kind, letter }, i) => (
            <span
              key={i}
              className={`${styles.poolItem} ${kind === 'green-unplaced' ? styles.poolGreen : styles.poolYellow}`}
            >
              {letter.toUpperCase()}
            </span>
          ))}
        </div>
      )}
      {error && <span className={styles.error}>{error}</span>}
      <span className={styles.hint}>click to focus · enter to guess · tab to fill greens</span>
    </div>
  );
}
