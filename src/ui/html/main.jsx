import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CliTerminal } from './components/CliTerminal.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CliTerminal autoFocus />
  </StrictMode>
);
