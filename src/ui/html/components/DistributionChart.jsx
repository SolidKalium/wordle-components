import { useStrategyStore, STRATEGY_DISPLAY_NAMES } from '../stores/strategyStore.js';
import styles from './DistributionChart.module.css';

const TURNS = [1, 2, 3, 4, 5, 6];

export function DistributionChart() {
  const summary  = useStrategyStore(s => s.simulationSummary);
  const pending  = useStrategyStore(s => s.simulationPending);
  const progress = useStrategyStore(s => s.simulationProgress);
  const name     = useStrategyStore(s => s.strategyName);

  const label = STRATEGY_DISPLAY_NAMES[name] ?? name;

  if (pending && !summary) {
    const pct = progress ? Math.round(progress.i / progress.total * 100) : null;
    return (
      <div className={styles.shell}>
        <div className={styles.title}>{label}</div>
        <div className={styles.loading}>
          {pct !== null ? `Simulating… ${pct}%` : 'Simulating…'}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const { distribution, mean } = summary;
  const maxCount = Math.max(...TURNS.map(t => distribution[t] ?? 0), 1);

  return (
    <div className={styles.shell}>
      <div className={styles.title}>{label}</div>
      <div className={styles.bars}>
        {TURNS.map(t => {
          const count = distribution[t] ?? 0;
          const pct   = count / maxCount;
          return (
            <div key={t} className={styles.col}>
              <div className={styles.count}>{count > 0 ? count : ''}</div>
              <div className={styles.barTrack}>
                <div className={styles.bar} style={{ height: `${pct * 100}%` }} />
              </div>
              <div className={styles.turnLabel}>{t}</div>
            </div>
          );
        })}
      </div>
      <div className={styles.stat}>Expected: {mean.toFixed(2)} moves</div>
    </div>
  );
}
