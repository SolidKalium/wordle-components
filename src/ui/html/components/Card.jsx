import { useRef, useState } from 'react';
import { CardVisibilityProvider } from './CardVisibilityContext.jsx';
import styles from './Card.module.css';

export function Card({ title, children, variant = 'default', collapsible = false, defaultCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [savedWidth, setSavedWidth] = useState(null);
  const cardRef = useRef(null);

  const toggle = () => {
    if (!collapsed && cardRef.current) {
      setSavedWidth(cardRef.current.offsetWidth);
    }
    setCollapsed(c => !c);
  };

  return (
    <div
      ref={cardRef}
      className={`${styles.card} ${styles[variant]}`}
      style={collapsed && savedWidth ? { width: savedWidth } : undefined}
    >
      {title && (
        <div
          className={`${styles.header} ${collapsible ? styles.headerCollapsible : ''}`}
          onClick={collapsible ? toggle : undefined}
        >
          <span className={styles.title}>{title}</span>
          {collapsible && (
            <span className={styles.collapseBtn}>
              <span style={{ display: 'inline-block', transition: 'transform 0.15s', transform: collapsed ? 'rotate(180deg)' : 'none' }}>▾</span>
            </span>
          )}
        </div>
      )}
      <CardVisibilityProvider value={!collapsed}>
        <div className={styles.body} style={collapsed ? { display: 'none' } : undefined}>{children}</div>
      </CardVisibilityProvider>
    </div>
  );
}
