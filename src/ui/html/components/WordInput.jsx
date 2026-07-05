import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore.js';
import { computePendingSlots } from '../../../lib/pendingWord.mjs';
import { MoveResult } from '../../../lib/game.mjs';
import { InputTiles } from './InputTiles.jsx';
import { VirtualKeyboard } from './VirtualKeyboard.jsx';
import styles from './WordInput.module.css';

const ERROR_TEXT = {
  [MoveResult.WRONG_LENGTH]:   'Must be 5 letters',
  [MoveResult.NOT_IN_LIST]:    'Not in word list',
};

const EMPTY_BUFFER = [null, null, null, null, null];
const MAX_CURSOR = 4; // cursor stays on a tile (never off the right edge)

export function WordInput({
  showKeyboard = true,
  showMissingLetters = false,
  defaultKeyboardHidden = false,
}) {
  const makeMove    = useGameStore(s => s.makeMove);
  const isOver      = useGameStore(s => s.isOver);
  const constraints = useGameStore(s => s.constraints);
  const answer      = useGameStore(s => s.answer);
  const guessCount  = useGameStore(s => s.guesses.length);
  const inputRefs = useRef(Array.from({ length: 5 }, () => null));
  const previousGuessCount = useRef(guessCount);

  const [buffer,   setBuffer]   = useState([...EMPTY_BUFFER]);
  const [cursor,   setCursor]   = useState(0);
  const [error,    setError]    = useState('');
  const [focused,  setFocused]  = useState(false);
  const [keyboardHidden, setKeyboardHidden] = useState(defaultKeyboardHidden);

  // Reset and refocus when a new game starts
  useEffect(() => {
    setBuffer([...EMPTY_BUFFER]);
    setCursor(0);
    setError('');
    inputRefs.current[0]?.focus();
  }, [answer]);

  // A move committed elsewhere (for example, by SuggestionPicker or another
  // input for this game) invalidates this tentative word. Decreases from undo
  // do not: an uncommitted draft can still be useful after stepping back.
  useEffect(() => {
    if (guessCount > previousGuessCount.current) {
      setBuffer([...EMPTY_BUFFER]);
      setCursor(0);
      setError('');
    }
    previousGuessCount.current = guessCount;
  }, [guessCount]);

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

  const focusPosition = (position) => {
    const next = Math.max(0, Math.min(MAX_CURSOR, position));
    setCursor(next);
    inputRefs.current[next]?.focus();
  };

  const enterLetter = (letter, position = cursor) => {
    if (isOver || !/[a-z]/i.test(letter)) return;
    const next = [...buffer];
    next[position] = letter.toLowerCase();
    setBuffer(next);
    focusPosition(Math.min(MAX_CURSOR, position + 1));
    setError('');
  };

  const backspace = (position = cursor) => {
    if (isOver) return;
    const index = buffer[position] === null ? position - 1 : position;
    if (index < 0) return;
    const next = [...buffer];
    next[index] = null;
    setBuffer(next);
    focusPosition(index);
    setError('');
  };

  const submitCurrent = () => {
    if (!isOver && buffer.every(c => c !== null)) submit(buffer);
  };

  const handleKeyDown = (position, e) => {
    if (isOver) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        submitCurrent();
        return;

      case 'Escape':
        e.currentTarget.blur();
        return;

      case 'Backspace':
        e.preventDefault();
        backspace(position);
        return;

      case 'Delete': {
        e.preventDefault();
        const next = [...buffer];
        next[position] = null;
        setBuffer(next);
        setError('');
        return;
      }

      case 'ArrowLeft':
        e.preventDefault();
        focusPosition(position - 1);
        return;

      case 'ArrowRight':
        e.preventDefault();
        focusPosition(position + 1);
        return;

      case ' ':
        e.preventDefault();
        focusPosition(position + 1);
        return;

      default:
        if (/^[a-zA-Z]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          enterLetter(e.key, position);
        }
    }
  };

  if (isOver) return null;

  return (
    <div className={styles.wrapper}>
      <InputTiles
        slots={slots}
        focused={focused}
        inputRefs={inputRefs}
        nativeKeyboardEnabled={!showKeyboard || keyboardHidden}
        onFocus={(position) => {
          setCursor(position);
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChange={(position, event) => {
          const letter = event.target.value.replace(/[^a-zA-Z]/g, '').slice(-1);
          if (letter) {
            enterLetter(letter, position);
          } else {
            const next = [...buffer];
            next[position] = null;
            setBuffer(next);
            setCursor(position);
            setError('');
          }
        }}
        onKeyDown={handleKeyDown}
      />
      {showMissingLetters && pool.length > 0 && (
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
      <span className={styles.hint}>click a tile to move · enter to guess</span>
      {showKeyboard && (
        <VirtualKeyboard
          constraints={constraints}
          hidden={keyboardHidden}
          onHiddenChange={setKeyboardHidden}
          onLetter={enterLetter}
          onBackspace={backspace}
          onEnter={submitCurrent}
        />
      )}
    </div>
  );
}
