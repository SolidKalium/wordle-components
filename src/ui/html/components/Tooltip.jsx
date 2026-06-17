import { useRef, useState } from 'react';
import { useFloating, autoUpdate, flip, shift, offset, FloatingPortal } from '@floating-ui/react';
import styles from './Tooltip.module.css';

export function Tip({ children }) {
  return <div className={styles.tip}>{children}</div>;
}

export function HintText({ children, tip }) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);

  const { refs, floatingStyles } = useFloating({
    open,
    placement: 'top-start',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const show = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), 200);
  };

  const hide = () => {
    clearTimeout(timerRef.current);
    setOpen(false);
  };

  return (
    <>
      <span
        ref={refs.setReference}
        className={styles.hintText}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </span>
      {open && (
        <FloatingPortal>
          <div ref={refs.setFloating} style={floatingStyles}>
            <Tip>{tip}</Tip>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
