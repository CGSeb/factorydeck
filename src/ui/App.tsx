import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import { Layout } from './Layout.tsx';
import type { LoadOverview } from './overview-api.ts';
import { OverviewPage } from './OverviewPage.tsx';
import type { LoadSession, LoadSessions } from './sessions-api.ts';
import { SessionPage } from './SessionPage.tsx';
import { SessionsPage } from './SessionsPage.tsx';
import type { LoadSkill, LoadSkills } from './skills-api.ts';
import { SkillPage } from './SkillPage.tsx';
import { SkillsPage } from './SkillsPage.tsx';

export interface AppProps {
  loadOverview: LoadOverview;
  loadSessions: LoadSessions;
  loadSession: LoadSession;
  loadSkills: LoadSkills;
  loadSkill: LoadSkill;
}

export function App({
  loadOverview,
  loadSessions,
  loadSession,
  loadSkills,
  loadSkill,
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
        <Route path="skills" element={<SkillsPage loadSkills={loadSkills} />} />
        <Route
          path="skills/:name"
          element={<SkillPage loadSkill={loadSkill} />}
        />
      </Route>
    </Routes>
  );
}
