import { useStrategyStore, STRATEGIES } from '../stores/strategyStore.js';
import { EXPLORATION_FILTERS } from '../../../lib/filter.mjs';
import styles from './StrategySelector.module.css';

export function StrategySelector({ showFilters = true }) {
  const strategyId = useStrategyStore(s => s.strategyId);
  const filterId   = useStrategyStore(s => s.filterId);
  const setStrategy = useStrategyStore(s => s.setStrategy);
  const setFilter   = useStrategyStore(s => s.setFilter);

  return (
    <div className={styles.selector}>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Strategy</span>
        {STRATEGIES.map(s => (
          <button
            key={s.id}
            className={`${styles.option} ${s.id === strategyId ? styles.active : ''}`}
            onClick={() => setStrategy(s.id)}
          >
            {s.displayName}
          </button>
        ))}
      </div>
      {showFilters && (
        <div className={styles.row}>
          <span className={styles.rowLabel}>Filter</span>
          <button
            className={`${styles.option} ${filterId === null ? styles.active : ''}`}
            onClick={() => setFilter(null)}
          >
            None
          </button>
          {EXPLORATION_FILTERS.map(f => (
            <button
              key={f.id}
              className={`${styles.option} ${f.id === filterId ? styles.active : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
