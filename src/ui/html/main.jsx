import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ANSWERS, WORDS } from '../../lib/words.gen.mjs';
import { GameStoreContext, createGameStore } from './stores/gameStore.js';
import { StrategyStoreContext, createStrategyStore } from './stores/strategyStore.js';
import { Card } from './components/Card.jsx';
import { CliTerminal } from './components/CliTerminal.jsx';
import { DistributionChart } from './components/DistributionChart.jsx';
import { GameBoard } from './components/GameBoard.jsx';
import { StrategySelector } from './components/StrategySelector.jsx';
import { SuggestionPicker } from './components/SuggestionPicker.jsx';
import { TreeNavigator } from './components/TreeNavigator.jsx';
import { WordInput } from './components/WordInput.jsx';
import './page.css';

const gameStore = createGameStore({ wordList: WORDS, answers: ANSWERS });
const strategyStoreMaxGroups = createStrategyStore({ strategyId: 'maxGroups' });
const strategyStoreMaxEntropy = createStrategyStore({ strategyId: 'maxEntropy' });
const strategyStoreMinExpectedRemaining = createStrategyStore({ strategyId: 'minExpectedRemaining' });
const strategyStoreMinimax = createStrategyStore({ strategyId: 'minimax' });
const strategyStoreFirstWord = createStrategyStore({ strategyId: 'firstWord' });
const strategyStoreRandom  = createStrategyStore({ strategyId: 'random' });
const strategyStoreExplore = createStrategyStore({ strategyId: 'maxGroups' });

function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, padding: 24 }}>
      <Card title="Strategy Distributions (hard mode, answers only)" collapsible defaultCollapsed>
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
          <StrategyStoreContext.Provider value={strategyStoreRandom}>
            <DistributionChart  defaultCollapsed={false} collapsible={false}/>
          </StrategyStoreContext.Provider>
        </div>
      </Card>
      <StrategyStoreContext.Provider value={strategyStoreExplore}>
        <Card title="Strategy Explorer (hard mode, answers only)" collapsible defaultCollapsed>
          <StrategySelector />
          <DistributionChart />
        </Card>
        <Card title="Decision Tree (hard mode, answers only)" collapsible>
          <StrategySelector showFilters={false} />
          <TreeNavigator />
        </Card>
      </StrategyStoreContext.Provider>
      <Card title="Game" collapsible>
        {/* fixed width keeps centered content stable as suggestions load/change */}
        <div style={{ width: 'calc(5 * 48px + 4 * 4px + 2 * 16px)' }}>
          <GameBoard />
          <WordInput />
          <SuggestionPicker />
        </div>
      </Card>
      <Card title="Terminal" variant="dark" collapsible defaultCollapsed>
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
