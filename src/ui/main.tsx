import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { fetchHealthMessage } from './health-message.ts';

const root = document.querySelector('#root');
if (root) createRoot(root).render(<App healthMessage={fetchHealthMessage()} />);
