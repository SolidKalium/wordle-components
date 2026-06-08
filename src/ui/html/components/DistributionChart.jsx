import { useState } from 'react';
import { useStrategyStore, STRATEGY_DISPLAY_NAMES } from '../stores/strategyStore.js';
import styles from './DistributionChart.module.css';

const WORDLE_MAX = 6;

function buildBuckets(distribution, collapsed) {
  const allTurns = Object.keys(distribution).map(Number).sort((a, b) => a - b);
  const hasOverflow = allTurns.some(t => t > WORDLE_MAX);

  if (!hasOverflow) {
    return { buckets: allTurns.map(t => ({ key: t, label: String(t), count: distribution[t], overflow: false })), hasOverflow: false };
  }

  if (collapsed) {
    const overflowCount = allTurns.filter(t => t > WORDLE_MAX).reduce((s, t) => s + distribution[t], 0);
    const buckets = Array.from({ length: WORDLE_MAX }, (_, i) => ({
      key: i + 1, label: String(i + 1), count: distribution[i + 1] ?? 0, overflow: false,
    }));
    buckets.push({ key: 'overflow', label: '7+', count: overflowCount, overflow: true });
    return { buckets, hasOverflow: true };
  }

  return {
    buckets: allTurns.map(t => ({ key: t, label: String(t), count: distribution[t], overflow: t > WORDLE_MAX })),
    hasOverflow: true,
  };
}

export function DistributionChart() {
  const summary  = useStrategyStore(s => s.simulationSummary);
  const pending  = useStrategyStore(s => s.simulationPending);
  const progress = useStrategyStore(s => s.simulationProgress);
  const name     = useStrategyStore(s => s.strategyName);
  const [collapsed, setCollapsed] = useState(true);

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
  const { buckets, hasOverflow } = buildBuckets(distribution, collapsed);
  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  return (
    <div className={styles.shell}>
      <div className={styles.title}>{label}</div>
      <div className={styles.bars}>
        {buckets.map(({ key, label: bucketLabel, count, overflow }) => (
          <div key={key} className={styles.col}>
            <div className={styles.count}>{count > 0 ? count : ''}</div>
            <div className={styles.barTrack}>
              <div
                className={overflow ? styles.barOverflow : styles.bar}
                style={{ height: `${(count / maxCount) * 100}%` }}
              />
            </div>
            <div className={styles.turnLabel}>{bucketLabel}</div>
          </div>
        ))}
      </div>
      <div className={styles.footer}>
        <span className={styles.stat}>Expected: {mean.toFixed(2)} moves</span>
        {hasOverflow && (
          <button className={styles.toggle} onClick={() => setCollapsed(c => !c)}>
            {collapsed ? 'expand' : 'collapse'}
          </button>
        )}
      </div>
    </div>
  );
}
