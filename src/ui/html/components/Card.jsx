import { useState } from 'react';
import styles from './Card.module.css';

export function Card({ title, children, variant = 'default', collapsible = false, defaultCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={`${styles.card} ${styles[variant]}`}>
      {title && (
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          {collapsible && (
            <button className={styles.collapseBtn} onClick={() => setCollapsed(c => !c)}>
              {collapsed ? '▾' : '▴'}
            </button>
          )}
        </div>
      )}
      {!collapsed && <div className={styles.body}>{children}</div>}
    </div>
  );
}
