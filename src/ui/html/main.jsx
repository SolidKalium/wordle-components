import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ANSWERS, WORDS } from '../../lib/words.gen.mjs';
import { GameStoreContext, createGameStore } from './stores/gameStore.js';
import { StrategyStoreContext, createStrategyStore } from './stores/strategyStore.js';
import { Card } from './components/Card.jsx';
import { CliTerminal } from './components/CliTerminal.jsx';
import { DistributionChart } from './components/DistributionChart.jsx';
import './page.css';

const gameStore     = createGameStore({ wordList: WORDS, answers: ANSWERS });
const strategyStore = createStrategyStore({ strategyName: 'maxGroups' });

function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, padding: 24 }}>
      <Card title="Strategy Distribution" collapsible>
        <DistributionChart />
      </Card>
      <Card title="Terminal" variant="dark">
        <CliTerminal autoFocus />
      </Card>
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
