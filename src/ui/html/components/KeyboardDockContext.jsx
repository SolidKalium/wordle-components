import { createContext, useCallback, useMemo, useState } from 'react';

export const KeyboardDockContext = createContext(null);

export function KeyboardDockProvider({ children }) {
  const [pinnedKeyboardId, setPinnedKeyboardId] = useState(null);

  const pin = useCallback((keyboardId) => {
    setPinnedKeyboardId(keyboardId);
  }, []);

  const release = useCallback((keyboardId) => {
    setPinnedKeyboardId(current => current === keyboardId ? null : current);
  }, []);

  const value = useMemo(() => ({ pinnedKeyboardId, pin, release }), [pinnedKeyboardId, pin, release]);

  return <KeyboardDockContext.Provider value={value}>{children}</KeyboardDockContext.Provider>;
}
