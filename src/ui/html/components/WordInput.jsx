import { useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore.js';
import { MoveResult } from '../../../lib/game.mjs';
import styles from './WordInput.module.css';

const ERROR_TEXT = {
  [MoveResult.WRONG_LENGTH]:   'Must be 5 letters',
  [MoveResult.NOT_IN_LIST]:    'Not in word list',
};

export function WordInput() {
  const makeMove = useGameStore(s => s.makeMove);
  const isOver   = useGameStore(s => s.isOver);
  const inputRef = useRef(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const word = value.trim().toLowerCase();
    if (!word) return;
    const result = makeMove(word);
    if (result.valid) {
      setValue('');
      setError('');
      inputRef.current?.focus();
    } else {
      const msg = ERROR_TEXT[result.error] ?? result.detail ?? `Invalid (${result.error})`;
      setError(msg);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') submit();
    if (error) setError('');
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          maxLength={5}
          placeholder="word"
          value={value}
          disabled={isOver}
          onChange={e => setValue(e.target.value.toLowerCase().replace(/[^a-z]/g, ''))}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <button
          className={styles.button}
          disabled={isOver || value.length !== 5}
          onClick={submit}
        >
          Guess
        </button>
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
