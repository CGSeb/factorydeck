import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import { Layout } from './Layout.tsx';
import type { LoadOverview } from './overview-api.ts';
import { OverviewPage } from './OverviewPage.tsx';

export interface AppProps {
  loadOverview: LoadOverview;
}

export function App({ loadOverview }: AppProps): ReactElement {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<OverviewPage loadOverview={loadOverview} />} />
      </Route>
    </Routes>
  );
}
