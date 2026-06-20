import { useGameStore } from '../stores/gameStore.js';
import { useSuggestions } from './useSuggestions.js';
import styles from './SuggestionPicker.module.css';

export function SuggestionPicker() {
  const remainingWords = useGameStore(s => s.remainingWords);
  const isOver         = useGameStore(s => s.isOver);
  const makeMove       = useGameStore(s => s.makeMove);

  const { suggestions, loading } = useSuggestions(remainingWords);

  if (isOver) return null;

  return (
    <div className={styles.picker}>
      <span className={styles.label}>Suggestions</span>
      <div className={styles.words}>
        {loading && suggestions.length === 0
          ? <span className={styles.loading}>…</span>
          : suggestions.map(w => (
              <button
                key={w}
                className={`${styles.word} ${loading ? styles.stale : ''}`}
                onClick={() => makeMove(w)}
              >
                {w}
              </button>
            ))
        }
      </div>
    </div>
  );
}
