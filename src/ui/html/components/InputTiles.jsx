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

/** Renders a pre-graded in-progress word as a row of 5 tiles. */
export function InputTiles({ slots, tileSize = 48 }) {
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
        <span
          key={i}
          className={[
            styles.tile,
            KIND_CLASS[kind] ?? styles.candidate,
            atCursor ? styles.cursor : '',
          ].join(' ')}
        >
          {letter?.toUpperCase() ?? ''}
        </span>
      ))}
    </span>
  );
}
