import { useState } from 'react';
import {
  useFloating, autoUpdate, flip, shift, offset, FloatingPortal,
  useHover, useFocus, useClick, useDismiss, useRole, useInteractions,
} from '@floating-ui/react';
import styles from './Tooltip.module.css';

export function Tip({ children }) {
  return <div className={styles.tip}>{children}</div>;
}

// Opens on mouse hover, keyboard focus, or tap (touch/pen). Escape or a press
// outside closes it.
export function HintText({ children, tip, underline = true, className = '' }) {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'top-start',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { delay: { open: 200 }, mouseOnly: true }),
    useFocus(context),
    useClick(context, { ignoreMouse: true }),
    useDismiss(context),
    useRole(context, { role: 'tooltip' }),
  ]);

  return (
    <>
      <span
        ref={refs.setReference}
        className={`${styles.hintText} ${underline ? styles.underline : ''} ${className}`}
        tabIndex={0}
        {...getReferenceProps()}
      >
        {children}
      </span>
      {open && (
        <FloatingPortal>
          <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}>
            <Tip>{tip}</Tip>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
