import { useMemo } from 'react';
import { useConstraintStore } from '../stores/constraintStore.js';
import { useGameStore } from '../stores/gameStore.js';
import styles from './ConstraintView.module.css';

function Pips({ green = 0, yellow = 0 }) {
  if (green === 0 && yellow === 0) return null;
  return (
    <>
      {green > 0 && (
        <div className={styles.pipsLeft}>
          {Array.from({ length: green }, (_, i) => <span key={i} className={styles.pip} />)}
        </div>
      )}
      {yellow > 0 && (
        <div className={styles.pipsRight}>
          {Array.from({ length: yellow }, (_, i) => <span key={i} className={styles.pip} />)}
        </div>
      )}
    </>
  );
}

function KnownTile({ letter, greenPips, yellowPips, grayBar }) {
  if (!letter) return <div className={`${styles.tile} ${styles.tileEmpty}`} />;
  return (
    <div className={`${styles.tile} ${styles.tileKnown}`}>
      <span className={styles.bigLabel}>{letter.toUpperCase()}</span>
      <Pips green={greenPips} yellow={yellowPips} />
      {grayBar && <div className={styles.grayBar} />}
    </div>
  );
}

function NotAtTile({ letters }) {
  if (letters.length === 0) return <div className={`${styles.tile} ${styles.tileEmpty}`} />;
  return (
    <div className={`${styles.tile} ${styles.tileNotAt}`}>
      <span className={styles.notAtLabel}>{letters.join('').toUpperCase()}</span>
    </div>
  );
}

function UnplacedTile({ letter, greenPips, yellowPips, grayBar }) {
  return (
    <div className={`${styles.tile} ${styles.tileUnplaced}`}>
      <span className={styles.bigLabel}>{letter.toUpperCase()}</span>
      <Pips green={greenPips} yellow={yellowPips} />
      {grayBar && <div className={styles.grayBar} />}
    </div>
  );
}

// Pure display component — accepts raw constraint arrays.
export function ConstraintView({ green, yellow, unplaced, gray }) {
  const graySet     = useMemo(() => new Set(gray),     [gray]);
  const unplacedSet = useMemo(() => new Set(unplaced), [unplaced]);

  const greenCount  = (l) => green.filter(g => g === l).length;
  const yellowCount = (l) => unplaced.filter(u => u === l).length;

  const anyKnown        = green.some(g => g);
  const anyNotAt        = yellow.some(ys => ys.length > 0);
  const unplacedLetters = [...unplacedSet].sort();
  const grayRowLetters  = [...graySet].filter(l => !unplacedSet.has(l)).sort();

  if (!anyKnown && !anyNotAt && unplacedLetters.length === 0 && grayRowLetters.length === 0) {
    return null;
  }

  return (
    <div className={styles.view}>
      {(anyKnown || anyNotAt) && (
        <div className={styles.slots}>
          {green.map((letter, i) =>
            letter
              ? <KnownTile key={i} letter={letter} greenPips={greenCount(letter)} yellowPips={yellowCount(letter)} grayBar={graySet.has(letter)} />
              : <NotAtTile key={i} letters={yellow[i]} />
          )}
        </div>
      )}

      {unplacedLetters.length > 0 && (
        <div className={styles.slots}>
          {unplacedLetters.map(l => (
            <UnplacedTile
              key={l}
              letter={l}
              greenPips={greenCount(l)}
              yellowPips={yellowCount(l)}
              grayBar={graySet.has(l)}
            />
          ))}
        </div>
      )}

      {grayRowLetters.length > 0 && (
        <div className={styles.grayRow}>
          {grayRowLetters.map(l => (
            <span key={l} className={styles.grayLetter}>{l.toUpperCase()}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// Reads from the manual constraint store.
export function ConstraintStoreView() {
  const green    = useConstraintStore(s => s.green);
  const yellow   = useConstraintStore(s => s.yellow);
  const unplaced = useConstraintStore(s => s.unplaced);
  const gray     = useConstraintStore(s => s.gray);
  return <ConstraintView green={green} yellow={yellow} unplaced={unplaced} gray={gray} />;
}

// Derives display data from the game store's ConstraintState.
// yellow[i] = letters excluded from that position that are still known to be in the word.
// unplaced  = one entry per unplaced copy of each letter (minCounts minus placed greens).
// gray      = eliminated letters (max count = 0).
export function GameConstraintView() {
  const cs = useGameStore(s => s.constraints);

  const { green, yellow, unplaced, gray } = useMemo(() => {
    const green   = cs.known;
    const yellow  = cs.excluded.map(excl => [...excl].filter(l => !cs.eliminated.has(l)));
    const unplaced = [];
    for (const [letter, min] of cs.minCounts) {
      const placed = cs.known.filter(k => k === letter).length;
      for (let i = 0; i < min - placed; i++) unplaced.push(letter);
    }
    const gray = [...cs.eliminated];
    return { green, yellow, unplaced, gray };
  }, [cs]);

  return <ConstraintView green={green} yellow={yellow} unplaced={unplaced} gray={gray} />;
}
