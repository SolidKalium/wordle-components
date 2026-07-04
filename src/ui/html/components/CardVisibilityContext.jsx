import { createContext, useContext } from 'react';

const CardVisibilityContext = createContext(true);

export const useCardVisibility = () => useContext(CardVisibilityContext);
export const CardVisibilityProvider = CardVisibilityContext.Provider;
