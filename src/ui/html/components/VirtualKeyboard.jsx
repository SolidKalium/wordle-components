import { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
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
      tabIndex={-1}
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

function KeyboardIcon({ slashed = false }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="1.5" y="4" width="17" height="12" rx="2" />
      <path d="M4 7h1M8 7h1M12 7h1M16 7h0M4 10h1M8 10h1M12 10h1M16 10h0M5 13h10" />
      {slashed && <path d="m3 17 14-14" className={styles.iconSlash} />}
    </svg>
  );
}

function PinIcon({ pinned = false }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7 2.5h6l-1 4 2.5 2.5v1.5h-4v6l-.5 1-.5-1v-6h-4V9L8 6.5Z" />
      {pinned && <path d="m4 16 12-12" />}
    </svg>
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
  hidden = false,
  onHiddenChange,
  defaultPinned = false,
}) {
  const keyboardId = useId();
  const dock = useContext(KeyboardDockContext);
  const cardVisible = useCardVisibility();
  const [prefersPinned, setPrefersPinned] = useState(defaultPinned);
  const isPinned = dock?.pinnedKeyboardId === keyboardId;
  const wasPinned = useRef(false);
  const pin = dock?.pin;
  const releasePin = dock?.release;

  useEffect(() => {
    if (!dock && import.meta.env.DEV) {
      console.warn('VirtualKeyboard should be rendered inside KeyboardDockProvider; pinning is disabled.');
    }
  }, [dock]);

  // Hidden/collapsed keyboards retain their placement preference but cannot
  // actively occupy the singleton dock. Showing/reopening requests it again.
  useLayoutEffect(() => {
    if (cardVisible && !hidden && prefersPinned) pin?.(keyboardId);
    else releasePin?.(keyboardId);
  }, [cardVisible, hidden, keyboardId, pin, prefersPinned, releasePin]);

  // A visible keyboard that loses the dock to another keyboard also loses its
  // pin preference. Inactive hidden/collapsed keyboards keep their preference.
  useLayoutEffect(() => {
    if (wasPinned.current && !isPinned && cardVisible && !hidden) {
      setPrefersPinned(false);
    }
    wasPinned.current = isPinned;
  }, [cardVisible, hidden, isPinned]);

  useEffect(() => () => releasePin?.(keyboardId), [keyboardId, releasePin]);

  const press = (key) => {
    if (key === 'Enter') onEnter();
    else if (key === 'Backspace') onBackspace();
    else onLetter(key);
  };

  const togglePinned = () => {
    const next = !prefersPinned;
    setPrefersPinned(next);
    if (next) pin?.(keyboardId);
    else releasePin?.(keyboardId);
  };

  const toggleHidden = () => {
    if (hidden && prefersPinned) pin?.(keyboardId);
    onHiddenChange?.(!hidden);
  };

  return (
    <div className={`${styles.dock} ${isPinned ? styles.pinned : ''}`}>
      <div className={styles.originControls}>
        {!hidden && dock && (
          <button
            type="button"
            className={`${styles.control} ${styles.pinControl}`}
            onClick={togglePinned}
            aria-label={prefersPinned ? 'Unpin keyboard' : 'Pin keyboard'}
            title={prefersPinned ? 'Unpin keyboard' : 'Pin keyboard'}
          >
            <PinIcon pinned={prefersPinned} />
          </button>
        )}
        <button
          type="button"
          className={styles.control}
          onClick={toggleHidden}
          aria-label={hidden ? 'Show keyboard' : 'Hide keyboard'}
          title={hidden ? 'Show keyboard' : 'Hide keyboard'}
        >
          <KeyboardIcon slashed={!hidden} />
        </button>
      </div>
      {!hidden && (
        <div className={styles.shell}>
          {isPinned && (
            <button
              type="button"
              className={styles.dockUnpin}
              onClick={togglePinned}
              aria-label="Unpin docked keyboard"
              title="Unpin keyboard"
            >
              <PinIcon pinned />
            </button>
          )}
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
                  tabIndex={-1}
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
      )}
    </div>
  );
}
