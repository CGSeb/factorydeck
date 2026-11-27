import { useEffect, useState, type ReactElement } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router';
import type { LoadAuthState, SetupManager } from './auth-api.ts';
import type { LoadBugs } from './bugs-api.ts';
import { BugsPage } from './BugsPage.tsx';
import type { DeleteProject, LoadFactory } from './factory-api.ts';
import { FeaturePage } from './FeaturePage.tsx';
import type { LoadFeature, LoadFeatures } from './features-api.ts';
import { FeaturesPage } from './FeaturesPage.tsx';
import type { LoadFrictions } from './frictions-api.ts';
import type { LoadOccurrences, LoadOutput } from './occurrences-api.ts';
import { FrictionsPage } from './FrictionsPage.tsx';
import type { LoadCollection, RefreshCollection } from './git-host-api.ts';
import { Layout } from './Layout.tsx';
import type { LoadOverview } from './overview-api.ts';
import { OverviewPage } from './OverviewPage.tsx';
import type { LoadRoles } from './roles-api.ts';
import { RolesPage } from './RolesPage.tsx';
import { SetupPage } from './SetupPage.tsx';
import type { LoadSession, LoadSessions } from './sessions-api.ts';
import { SessionPage } from './SessionPage.tsx';
import { SessionsPage } from './SessionsPage.tsx';
import type { LoadSidebar } from './sidebar-api.ts';
import type { LoadSkill, LoadSkills } from './skills-api.ts';
import { SkillPage } from './SkillPage.tsx';
import { SkillsPage } from './SkillsPage.tsx';
import type {
  LoadAutonomy,
  LoadBugStats,
  LoadFlow,
  LoadQuality,
  LoadWaiting,
} from './stats-api.ts';
import { StatsPage } from './StatsPage.tsx';

export interface AppProps {
  loadOverview: LoadOverview;
  loadSessions: LoadSessions;
  loadSession: LoadSession;
  loadSkills: LoadSkills;
  loadSkill: LoadSkill;
  loadRoles: LoadRoles;
  loadFeatures: LoadFeatures;
  loadFeature: LoadFeature;
  loadBugs: LoadBugs;
  loadFactory: LoadFactory;
  deleteProject: DeleteProject;
  loadCollection: LoadCollection;
  refreshCollection: RefreshCollection;
  loadAutonomy: LoadAutonomy;
  loadQuality: LoadQuality;
  loadFrictions: LoadFrictions;
  loadOccurrences: LoadOccurrences;
  loadOutput: LoadOutput;
  loadFlow: LoadFlow;
  loadBugStats: LoadBugStats;
  loadWaiting: LoadWaiting;
  loadSidebar?: LoadSidebar | undefined;
  loadAuthState?: LoadAuthState | undefined;
  setupManager?: SetupManager | undefined;
}

type AuthPhase = 'checking' | 'setup' | 'ready';

function useAuthPhase(
  loadAuthState: LoadAuthState | undefined,
): [AuthPhase, (phase: AuthPhase) => void] {
  const [phase, setPhase] = useState<AuthPhase>(
    loadAuthState === undefined ? 'ready' : 'checking',
  );
  useEffect(() => {
    if (loadAuthState === undefined) return;
    let current = true;
    void loadAuthState().then((state) => {
      if (current) setPhase(state?.setup === true ? 'setup' : 'ready');
    });
    return () => {
      current = false;
    };
  }, [loadAuthState]);
  return [phase, setPhase];
}

export function App(props: AppProps): ReactElement | null {
  const { loadAuthState, setupManager } = props;
  const [phase, setPhase] = useAuthPhase(loadAuthState);
  const navigate = useNavigate();
  if (phase === 'checking') return null;
  if (phase === 'setup' && setupManager !== undefined) {
    return (
      <Routes>
        <Route
          path="setup"
          element={
            <SetupPage
              setupManager={setupManager}
              onCreated={() => {
                setPhase('ready');
                void navigate('/', { replace: true });
              }}
            />
          }
        />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }
  return <DashboardRoutes {...props} />;
}

function DashboardRoutes(props: AppProps): ReactElement {
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
        <Route path="bugs" element={<BugsPage {...props} />} />
        <Route
          path="bugs/:number"
          element={<FeaturePage loadFeature={loadFeature} kind="bug" />}
        />
        <Route path="stats" element={<StatsPage {...props} />} />
        <Route path="frictions" element={<FrictionsPage {...props} />} />
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
      <Route path="setup" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
