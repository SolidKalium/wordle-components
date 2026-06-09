import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ANSWERS, WORDS } from '../../lib/words.gen.mjs';
import { GameStoreContext, createGameStore } from './stores/gameStore.js';
import { StrategyStoreContext, createStrategyStore } from './stores/strategyStore.js';
import { Card } from './components/Card.jsx';
import { CliTerminal } from './components/CliTerminal.jsx';
import { DistributionChart } from './components/DistributionChart.jsx';
import './page.css';

const gameStore = createGameStore({ wordList: WORDS, answers: ANSWERS });
const strategyStoreMaxGroups = createStrategyStore({ strategyName: 'maxGroups' });
const strategyStoreMaxEntropy = createStrategyStore({ strategyName: 'maxEntropy' });
const strategyStoreMinExpectedRemaining = createStrategyStore({ strategyName: 'minExpectedRemaining' });
const strategyStoreMinimax = createStrategyStore({ strategyName: 'minimax' });
const strategyStoreFirstWord = createStrategyStore({ strategyName: 'firstWord' });

function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, padding: 24 }}>
      <Card title="Strategy Distributions" collapsible>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: 1, background: '#2c2c2e' }}>
          <StrategyStoreContext.Provider value={strategyStoreMaxGroups}>
            <DistributionChart defaultCollapsed={false} collapsible={false}/>
          </StrategyStoreContext.Provider>
          <StrategyStoreContext.Provider value={strategyStoreMaxEntropy}>
            <DistributionChart  defaultCollapsed={false} collapsible={false}/>
          </StrategyStoreContext.Provider>
          <StrategyStoreContext.Provider value={strategyStoreMinExpectedRemaining}>
            <DistributionChart  defaultCollapsed={false} collapsible={false}/>
          </StrategyStoreContext.Provider>
          <StrategyStoreContext.Provider value={strategyStoreMinimax}>
            <DistributionChart  defaultCollapsed={false} collapsible={false}/>
          </StrategyStoreContext.Provider>
          <StrategyStoreContext.Provider value={strategyStoreFirstWord}>
            <DistributionChart  defaultCollapsed={false} collapsible={false}/>
          </StrategyStoreContext.Provider>
        </div>
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
        <App />
    </GameStoreContext.Provider>
  </StrictMode>
);
