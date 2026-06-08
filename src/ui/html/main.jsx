import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ANSWERS, WORDS } from '../../lib/words.gen.mjs';
import { GameStoreContext, createGameStore } from './stores/gameStore.js';
import { StrategyStoreContext, createStrategyStore } from './stores/strategyStore.js';
import { CliTerminal } from './components/CliTerminal.jsx';
import { DistributionChart } from './components/DistributionChart.jsx';

const gameStore     = createGameStore({ wordList: WORDS, answers: ANSWERS });
const strategyStore = createStrategyStore({ strategyName: 'maxGroups' });

function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 24, padding: 24, background: '#121213', minHeight: '100vh' }}>
      <DistributionChart />
      <CliTerminal autoFocus />
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GameStoreContext.Provider value={gameStore}>
      <StrategyStoreContext.Provider value={strategyStore}>
        <App />
      </StrategyStoreContext.Provider>
    </GameStoreContext.Provider>
  </StrictMode>
);
