import { useContext, useEffect, useId, useState } from 'react';
import { KeyboardDockContext } from './KeyboardDockContext.jsx';
import { useCardVisibility } from './CardVisibilityContext.jsx';
import styles from './VirtualKeyboard.module.css';

const ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['Enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'Backspace'],
];

function keyKnowledge(letter, constraints) {
  const green = constraints.known.filter(value => value === letter).length;
  const minimum = constraints.minCounts.get(letter) ?? 0;
  const yellow = Math.max(0, minimum - green);
  const capped = constraints.maxCounts.has(letter);

  let state = 'unknown';
  if ((constraints.maxCounts.get(letter) ?? null) === 0) state = 'eliminated';
  else if (green > 0) state = 'green';
  else if (yellow > 0) state = 'yellow';

  return { state, green, yellow, capped };
}

function LetterKey({ letter, constraints, onPress, disabled }) {
  const { state, green, yellow, capped } = keyKnowledge(letter, constraints);

  return (
    <button
      type="button"
      className={`${styles.key} ${styles[state]}`}
      onClick={() => onPress(letter)}
      disabled={disabled}
      aria-label={letter.toUpperCase()}
    >
      <span>{letter.toUpperCase()}</span>
      {green > 0 && (
        <span className={styles.pipsLeft} aria-hidden="true">
          {Array.from({ length: green }, (_, i) => <i key={`g${i}`} className={styles.greenPip} />)}
        </span>
      )}
      {yellow > 0 && (
        <span className={styles.pipsRight} aria-hidden="true">
          {Array.from({ length: yellow }, (_, i) => <i key={`y${i}`} className={styles.yellowPip} />)}
        </span>
      )}
      {capped && <span className={styles.cap} aria-hidden="true" />}
    </button>
  );
}

/**
 * On-screen word-entry keyboard. Mount KeyboardDockProvider above every
 * VirtualKeyboard so only one instance can own the viewport dock at a time.
 * Without it, the keyboard remains usable inline and warns in development.
 */
export function VirtualKeyboard({
  constraints,
  onLetter,
  onEnter,
  onBackspace,
  disabled = false,
  defaultHidden = false,
}) {
  const keyboardId = useId();
  const dock = useContext(KeyboardDockContext);
  const cardVisible = useCardVisibility();
  const [hidden, setHidden] = useState(defaultHidden);
  const isPinned = dock?.pinnedKeyboardId === keyboardId;
  const releasePin = dock?.release;

  useEffect(() => {
    if (!dock && import.meta.env.DEV) {
      console.warn('VirtualKeyboard should be rendered inside KeyboardDockProvider; pinning is disabled.');
    }
  }, [dock]);

  useEffect(() => {
    if (!cardVisible || hidden) releasePin?.(keyboardId);
  }, [cardVisible, hidden, keyboardId, releasePin]);

  useEffect(() => () => releasePin?.(keyboardId), [keyboardId, releasePin]);

  const press = (key) => {
    if (key === 'Enter') onEnter();
    else if (key === 'Backspace') onBackspace();
    else onLetter(key);
  };

  if (hidden) {
    return (
      <div className={`${styles.dock} ${styles.hidden}`}>
        <button type="button" className={styles.control} onClick={() => setHidden(false)}>
          Show keyboard
        </button>
      </div>
    );
  }

  return (
    <div className={`${styles.dock} ${isPinned ? styles.pinned : ''}`}>
      <div className={styles.shell}>
        <div className={styles.controls}>
          <button type="button" className={styles.control} onClick={() => setHidden(true)}>
            Hide
          </button>
          {dock && (
            <button
              type="button"
              className={`${styles.control} ${styles.pinControl}`}
              onClick={() => isPinned ? dock.release(keyboardId) : dock.pin(keyboardId)}
            >
              {isPinned ? 'Unpin' : 'Pin'}
            </button>
          )}
        </div>
        <div className={styles.keyboard} role="group" aria-label="Word entry keyboard">
          {ROWS.map((row, rowIndex) => (
            <div className={styles.row} key={rowIndex}>
              {row.map(key => key.length === 1 ? (
                <LetterKey
                  key={key}
                  letter={key}
                  constraints={constraints}
                  onPress={press}
                  disabled={disabled}
                />
              ) : (
                <button
                  type="button"
                  key={key}
                  className={`${styles.key} ${styles.actionKey}`}
                  onClick={() => press(key)}
                  disabled={disabled}
                  aria-label={key}
                >
                  {key === 'Backspace' ? '⌫' : 'Enter'}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
