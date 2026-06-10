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

export function WordInput({ showPool = true }) {
  const makeMove    = useGameStore(s => s.makeMove);
  const isOver      = useGameStore(s => s.isOver);
  const constraints = useGameStore(s => s.constraints);
  const answer      = useGameStore(s => s.answer);
  const containerRef = useRef(null);

  const [buffer, setBuffer] = useState([...EMPTY_BUFFER]);
  const [cursor, setCursor] = useState(0);
  const [error,  setError]  = useState('');

  // Reset when a new game starts (answer changes)
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

      case 'Tab': {
        e.preventDefault();
        const next = buffer.map((c, i) => c ?? constraints.known[i] ?? null);
        const firstEmpty = next.findIndex(c => c === null);
        setBuffer(next);
        setCursor(firstEmpty === -1 ? 5 : firstEmpty);
        return;
      }

      case 'Backspace':
        e.preventDefault();
        if (cursor > 0) {
          const next = [...buffer];
          next[cursor - 1] = null;
          setBuffer(next);
          setCursor(cursor - 1);
          setError('');
        }
        return;

      case 'ArrowLeft':
        e.preventDefault();
        setCursor(c => Math.max(0, c - 1));
        return;

      case 'ArrowRight':
        e.preventDefault();
        setCursor(c => Math.min(5, c + 1));
        return;

      default:
        if (e.key.length === 1 && /[a-zA-Z]/.test(e.key) && cursor < 5) {
          e.preventDefault();
          const next = [...buffer];
          next[cursor] = e.key.toLowerCase();
          setBuffer(next);
          setCursor(c => Math.min(5, c + 1));
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
      onKeyDown={handleKeyDown}
      onClick={() => containerRef.current?.focus()}
    >
      <InputTiles slots={slots} />
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
