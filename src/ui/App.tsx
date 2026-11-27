import { useEffect, useState, type ReactElement } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router';
import {
  type LoadAuthState,
  type LoadMe,
  pageLeaver,
  SIGNED_OUT_PATH,
  type SetupManager,
  type SignOut,
} from './auth-api.ts';
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
import type { AccountView, SidebarAccount } from './components/Sidebar.tsx';
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
import type { LoadTeam } from './team-api.ts';
import { TeamPage } from './TeamPage.tsx';

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
  loadMe?: LoadMe | undefined;
  signOut?: SignOut | undefined;
  leavePage?: ((path: string) => void) | undefined;
  loadTeam?: LoadTeam | undefined;
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

function useAccountView(
  loadMe: LoadMe | undefined,
  entered: boolean,
): AccountView {
  const [view, setView] = useState<AccountView>({ status: 'loading' });
  useEffect(() => {
    if (loadMe === undefined || !entered) return;
    let current = true;
    void loadMe().then((result) => {
      if (!current) return;
      setView(
        result.status === 'account'
          ? { status: 'account', account: result.account }
          : { status: 'unavailable' },
      );
    });
    return () => {
      current = false;
    };
  }, [loadMe, entered]);
  return view;
}

function isManager(view: AccountView): boolean {
  return view.status === 'account' && view.account.role === 'manager';
}

function accountSlot(
  view: AccountView,
  { loadMe, signOut, leavePage }: AppProps,
): SidebarAccount | undefined {
  if (loadMe === undefined || signOut === undefined) return undefined;
  return {
    view,
    signOut,
    onSignedOut: () => {
      (leavePage ?? pageLeaver())(SIGNED_OUT_PATH);
    },
  };
}

export function App(props: AppProps): ReactElement | null {
  const { loadAuthState, setupManager, loadMe } = props;
  const [phase, setPhase] = useAuthPhase(loadAuthState);
  const view = useAccountView(loadMe, phase === 'ready');
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
  return (
    <DashboardRoutes
      {...props}
      account={accountSlot(view, props)}
      team={isManager(view)}
    />
  );
}

function DashboardRoutes(
  props: AppProps & { account: SidebarAccount | undefined; team: boolean },
): ReactElement {
  const {
    loadOverview,
    loadSessions,
    loadSession,
    loadSkills,
    loadSkill,
    loadRoles,
    loadFeatures,
    loadFeature,
    loadTeam,
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
        {loadTeam !== undefined && (
          <Route path="team" element={<TeamPage loadTeam={loadTeam} />} />
        )}
      </Route>
      <Route path="setup" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
