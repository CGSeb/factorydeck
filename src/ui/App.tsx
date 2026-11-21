import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import { Layout } from './Layout.tsx';
import type { LoadOverview } from './overview-api.ts';
import { OverviewPage } from './OverviewPage.tsx';
import type { LoadSession, LoadSessions } from './sessions-api.ts';
import { SessionPage } from './SessionPage.tsx';
import { SessionsPage } from './SessionsPage.tsx';

export interface AppProps {
  loadOverview: LoadOverview;
  loadSessions: LoadSessions;
  loadSession: LoadSession;
}

export function App({
  loadOverview,
  loadSessions,
  loadSession,
}: AppProps): ReactElement {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<OverviewPage loadOverview={loadOverview} />} />
        <Route
          path="sessions"
          element={<SessionsPage loadSessions={loadSessions} />}
        />
        <Route
          path="sessions/:id"
          element={<SessionPage loadSession={loadSession} />}
        />
      </Route>
    </Routes>
  );
}
