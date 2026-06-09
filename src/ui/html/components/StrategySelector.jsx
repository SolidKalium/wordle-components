import { useStrategyStore, STRATEGIES } from '../stores/strategyStore.js';
import styles from './StrategySelector.module.css';

export function StrategySelector() {
  const strategyId = useStrategyStore(s => s.strategyId);
  const setStrategy = useStrategyStore(s => s.setStrategy);

  return (
    <div className={styles.selector}>
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
  );
}
