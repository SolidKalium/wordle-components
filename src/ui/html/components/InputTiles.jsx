import styles from './InputTiles.module.css';

const KIND_CLASS = {
  empty:          styles.empty,
  green:          styles.green,
  grey:           styles.grey,
  'yellow-tile':  styles.yellowTile,
  'yellow-fg':    styles.yellowFg,
  default:        styles.candidate,
  candidate:      styles.candidate,
};

/** Renders a pre-graded in-progress word as five native, mobile-capable inputs. */
export function InputTiles({
  slots,
  tileSize = 48,
  focused = false,
  inputRefs,
  nativeKeyboardEnabled = false,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
}) {
  const gap      = tileSize <= 16 ? 2 : 4;
  const fontSize = Math.round(tileSize * 0.42);
  return (
    <span
      className={styles.tiles}
      style={{
        '--tile-size': `${tileSize}px`,
        '--tile-gap':  `${gap}px`,
        '--tile-font': `${fontSize}px`,
      }}
    >
      {slots.map(({ kind, letter, atCursor }, i) => (
        <input
          key={i}
          ref={element => { if (inputRefs) inputRefs.current[i] = element; }}
          value={letter?.toUpperCase() ?? ''}
          maxLength={2}
          readOnly={!nativeKeyboardEnabled}
          inputMode={nativeKeyboardEnabled ? 'text' : 'none'}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label={`Guess letter ${i + 1}`}
          className={[
            styles.tile,
            KIND_CLASS[kind] ?? styles.candidate,
            atCursor ? styles.cursor : '',
            atCursor && focused ? styles.cursorActive : '',
          ].join(' ')}
          onChange={event => onChange?.(i, event)}
          onBlur={() => onBlur?.(i)}
          onFocus={() => onFocus?.(i)}
          onKeyDown={event => onKeyDown?.(i, event)}
        />
      ))}
    </span>
  );
}
