import styles from './PatternTiles.module.css';

const CLASS = { G: styles.green, Y: styles.yellow, _: styles.grey };

export function PatternTiles({ pattern, tileSize = 12 }) {
  return (
    <span className={styles.tiles} style={{ '--tile-size': `${tileSize}px` }}>
      {[...pattern].map((ch, i) => (
        <span key={i} className={`${styles.tile} ${CLASS[ch] ?? styles.grey}`} />
      ))}
    </span>
  );
}
