import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import type { DeleteProject, LoadFactory } from './factory-api.ts';
import { FeaturePage } from './FeaturePage.tsx';
import type { LoadFeature, LoadFeatures } from './features-api.ts';
import { FeaturesPage } from './FeaturesPage.tsx';
import type { LoadCollection, RefreshCollection } from './git-host-api.ts';
import { Layout } from './Layout.tsx';
import type { LoadOverview } from './overview-api.ts';
import { OverviewPage } from './OverviewPage.tsx';
import type { LoadRoles } from './roles-api.ts';
import { RolesPage } from './RolesPage.tsx';
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
  loadRoles: LoadRoles;
  loadFeatures: LoadFeatures;
  loadFeature: LoadFeature;
  loadFactory: LoadFactory;
  deleteProject: DeleteProject;
  loadCollection: LoadCollection;
  refreshCollection: RefreshCollection;
}

export function App(props: AppProps): ReactElement {
  const {
    loadOverview,
    loadSessions,
    loadSession,
    loadSkills,
    loadSkill,
    loadRoles,
    loadFeatures,
    loadFeature,
  } = props;
  return (
    <Routes>
      <Route element={<Layout {...props} />}>
        <Route index element={<OverviewPage {...props} />} />
        <Route
          path="features"
          element={<FeaturesPage loadFeatures={loadFeatures} />}
        />
        <Route
          path="features/:number"
          element={<FeaturePage loadFeature={loadFeature} />}
        />
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
        <Route
          path="roles"
          element={
            <RolesPage loadRoles={loadRoles} loadOverview={loadOverview} />
          }
        />
      </Route>
    </Routes>
  );
}
