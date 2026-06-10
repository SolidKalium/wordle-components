import styles from './PatternTiles.module.css';

const PATTERN_CLASS = { G: styles.green, Y: styles.yellow, _: styles.grey };

/**
 * Renders a row of 5 Wordle-style tiles.
 *
 * - pattern "GY__G" + no letters → small colored squares (tree navigator)
 * - pattern + letters            → colored squares with letters (game board)
 * - pattern null                 → placeholder tiles (empty bordered squares)
 */
export function PatternTiles({ pattern, letters, tileSize = 12 }) {
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
      {Array.from({ length: 5 }, (_, i) => {
        const ch     = pattern?.[i] ?? null;
        const letter = letters?.[i]?.toUpperCase() ?? '';
        const cls    = ch ? (PATTERN_CLASS[ch] ?? styles.grey) : styles.placeholder;
        return (
          <span key={i} className={`${styles.tile} ${cls}`}>
            {letter}
          </span>
        );
      })}
    </span>
  );
}
