import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App.tsx';
import { overviewLoader } from './overview-api.ts';

const loadOverview = overviewLoader();
const root = document.querySelector('#root');
if (root) {
  createRoot(root).render(
    <BrowserRouter>
      <App loadOverview={loadOverview} />
    </BrowserRouter>,
  );
}
