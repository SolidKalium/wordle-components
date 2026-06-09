import { useEffect, useRef, useState } from 'react';
import { useStrategyStore } from '../stores/strategyStore.js';
import { PatternTiles } from './PatternTiles.jsx';
import styles from './TreeNavigator.module.css';

export function TreeNavigator() {
  const treeRoot  = useStrategyStore(s => s.treeRoot);
  const pending   = useStrategyStore(s => s.simulationPending);
  const progress  = useStrategyStore(s => s.simulationProgress);
  const [path, setPath] = useState([]); // array of pattern strings, one per depth level

  // Reset navigation when the tree changes (strategy/filter switch)
  const prevRoot = useRef(null);
  useEffect(() => {
    if (treeRoot !== prevRoot.current) {
      prevRoot.current = treeRoot;
      setPath([]);
    }
  }, [treeRoot]);

  if (pending) {
    const pct = progress ? Math.round((progress.i / progress.total) * 100) : null;
    return (
      <div className={styles.status}>
        {pct !== null ? `Building tree… ${pct}%` : 'Building tree…'}
      </div>
    );
  }

  if (!treeRoot) return null;

  // Walk path to build the list of nodes to show as columns
  const columns = [treeRoot];
  let current = treeRoot;
  for (const pattern of path) {
    const group = current.groups.find(g => g.pattern === pattern);
    if (!group) break;
    columns.push(group.child);
    current = group.child;
  }

  function selectAt(colIdx, pattern) {
    setPath([...path.slice(0, colIdx), pattern]);
  }

  return (
    <div className={styles.navigator}>
      {columns.map((node, colIdx) => (
        <TreeColumn
          key={colIdx}
          node={node}
          selectedPattern={path[colIdx]}
          onSelect={(pattern) => selectAt(colIdx, pattern)}
        />
      ))}
    </div>
  );
}

function TreeColumn({ node, selectedPattern, onSelect }) {
  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <span className={styles.guess}>{node.guess.toUpperCase()}</span>
        <span className={styles.stats}>
          {node.size} words
          {!isNaN(node.meanTurns) && ` · avg ${node.meanTurns.toFixed(2)}`}
          {` · max ${node.maxTurns}`}
        </span>
      </div>
      <div className={styles.groupList}>
        {node.groups.map(group => (
          <div
            key={group.pattern}
            className={`${styles.groupRow} ${group.pattern === selectedPattern ? styles.selected : ''}`}
            onClick={() => onSelect(group.pattern)}
          >
            <PatternTiles pattern={group.pattern} />
            <span className={styles.groupSize}>{group.size}</span>
            <span className={styles.nextGuess}>{group.child.guess}</span>
          </div>
        ))}
        {node.solvedCount > 0 && (
          <div className={styles.solvedRow}>
            <PatternTiles pattern="GGGGG" />
            <span className={styles.groupSize}>{node.solvedCount}</span>
            <span className={styles.nextGuessLabel}>solved</span>
          </div>
        )}
      </div>
    </div>
  );
}
