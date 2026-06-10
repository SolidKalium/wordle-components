import { useGameStore } from '../stores/gameStore.js';
import { PatternTiles } from './PatternTiles.jsx';
import styles from './GameBoard.module.css';

const TILE_SIZE  = 48;
const MAX_GUESSES = 6;

export function GameBoard() {
  const guesses = useGameStore(s => s.guesses);
  const isOver  = useGameStore(s => s.isOver);
  const solved  = useGameStore(s => s.solved);
  const answer  = useGameStore(s => s.answer);
  const newGame = useGameStore(s => s.newGame);

  return (
    <div className={styles.board}>
      <div className={styles.grid}>
        {Array.from({ length: MAX_GUESSES }, (_, row) => {
          const guess = guesses[row];
          return (
            <PatternTiles
              key={row}
              pattern={guess ? guess.pattern.join('') : null}
              letters={guess?.word}
              tileSize={TILE_SIZE}
            />
          );
        })}
      </div>

      {isOver && (
        <div className={styles.result}>
          {solved
            ? <span className={styles.win}>Solved in {guesses.length}/{MAX_GUESSES}</span>
            : <span className={styles.lose}>The word was <strong>{answer?.toUpperCase()}</strong></span>
          }
          <button className={styles.newGame} onClick={newGame}>New game</button>
        </div>
      )}
    </div>
  );
}
