import type { ReactElement } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router';
import {
  pageLeaver,
  SIGNED_OUT_PATH,
  type Account,
  type LoadAuthState,
  type LoadMe,
  type SetupManager,
  type SignIn,
  type SignOut,
} from './auth-api.ts';
import type { SessionGate } from './auth-gate.ts';
import { signInThenRead, useAccountView, useAuthPhase } from './auth-phase.ts';
import type { LoadBugs } from './bugs-api.ts';
import { BugsPage } from './BugsPage.tsx';
import type { DeleteProject, LoadFactory } from './factory-api.ts';
import { FeaturePage } from './FeaturePage.tsx';
import type { LoadFeature, LoadFeatures } from './features-api.ts';
import { FeaturesPage } from './FeaturesPage.tsx';
import type { LoadFrictions, LoadReport } from './frictions-api.ts';
import type { LoadOccurrences, LoadOutput } from './occurrences-api.ts';
import { FrictionsPage } from './FrictionsPage.tsx';
import type { LoadCollection, RefreshCollection } from './git-host-api.ts';
import type { AccountView, SidebarAccount } from './components/Sidebar.tsx';
import type {
  AcceptInvitation,
  InvitationActions,
  ReadInvitation,
} from './invitations-api.ts';
import { inviteScreen } from './InvitePage.tsx';
import { Layout } from './Layout.tsx';
import type { LoadOverview } from './overview-api.ts';
import { OverviewPage } from './OverviewPage.tsx';
import type { LoadRoles } from './roles-api.ts';
import { RolesPage } from './RolesPage.tsx';
import { SetupPage } from './SetupPage.tsx';
import { nextOf, signInPath } from './sign-in-next.ts';
import { SignInPage } from './SignInPage.tsx';
import { UnreachableScreen } from './UnreachableScreen.tsx';
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
import type { ChangeRole } from './role-change-api.ts';
import type { ChangeActive } from './account-status-api.ts';
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
  loadReport?: LoadReport | undefined;
  markReport?: LoadReport | undefined;
  loadAuthState?: LoadAuthState | undefined;
  setupManager?: SetupManager | undefined;
  loadMe?: LoadMe | undefined;
  signIn?: SignIn | undefined;
  sessionGate?: SessionGate | undefined;
  signOut?: SignOut | undefined;
  leavePage?: ((path: string) => void) | undefined;
  loadTeam?: LoadTeam | undefined;
  changeRole?: ChangeRole | undefined;
  invitationActions?: InvitationActions | undefined;
  readInvitation?: ReadInvitation | undefined;
  acceptInvitation?: AcceptInvitation | undefined;
  changeActive?: ChangeActive | undefined;
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

function RedirectToSignIn(): ReactElement {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={signInPath(`${pathname}${search}${hash}`)} replace />;
}

function SignedInRedirect(): ReactElement {
  const { search } = useLocation();
  return <Navigate to={nextOf(search)} replace />;
}

function SignInRoutes({
  signIn,
  loadMe,
  sessionGate,
  onAccount,
}: {
  signIn: SignIn;
  loadMe: LoadMe | undefined;
  sessionGate: SessionGate | undefined;
  onAccount: (account: Account) => void;
}): ReactElement {
  const navigate = useNavigate();
  const { search } = useLocation();
  const send = signInThenRead(signIn, loadMe, sessionGate);
  return (
    <Routes>
      <Route
        path="sign-in"
        element={
          <SignInPage
            signIn={send}
            onSignedIn={(account) => {
              onAccount(account);
              void navigate(nextOf(search), { replace: true });
            }}
          />
        }
      />
      <Route path="*" element={<RedirectToSignIn />} />
    </Routes>
  );
}

export function App(props: AppProps): ReactElement | null {
  const { setupManager, signIn, loadMe, sessionGate } = props;
  const [phase, setPhase, retry] = useAuthPhase(props);
  const view = useAccountView(loadMe, phase, () =>
    setPhase({ name: 'signed-out' }),
  );
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (phase.name === 'checking') return null;
  const invite = inviteScreen(pathname, phase, props, () => {
    setPhase({ name: 'ready', account: undefined });
    void navigate('/', { replace: true });
  });
  if (invite !== undefined) return invite;
  if (phase.name === 'unreachable') {
    return (
      <UnreachableScreen
        message={phase.message}
        retrying={phase.retrying}
        onRetry={retry}
      />
    );
  }
  if (phase.name === 'signed-out' && signIn !== undefined) {
    return (
      <SignInRoutes
        signIn={signIn}
        loadMe={loadMe}
        sessionGate={sessionGate}
        onAccount={(account) => setPhase({ name: 'ready', account })}
      />
    );
  }
  if (phase.name === 'setup' && setupManager !== undefined) {
    return (
      <Routes>
        <Route
          path="setup"
          element={
            <SetupPage
              setupManager={setupManager}
              onCreated={() => {
                setPhase({ name: 'ready', account: undefined });
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

const SIGNED_IN_REDIRECTS = (
  <>
    <Route path="setup" element={<Navigate to="/" replace />} />
    <Route path="sign-in" element={<SignedInRedirect />} />
  </>
);

function teamRoute(props: AppProps): ReactElement | undefined {
  const { loadTeam } = props;
  if (loadTeam === undefined) return undefined;
  return (
    <Route path="team" element={<TeamPage {...props} loadTeam={loadTeam} />} />
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
        {teamRoute(props)}
      </Route>
      {SIGNED_IN_REDIRECTS}
    </Routes>
  );
}
