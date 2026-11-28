import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './design/tokens.css';
import './design/theme-dark.css';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { App } from './App.tsx';
import {
  authStateLoader,
  managerSetup,
  meLoader,
  pageLeaver,
  signInSender,
  signOuter,
} from './auth-api.ts';
import { authGate } from './auth-gate.ts';
import { bugsLoader } from './bugs-api.ts';
import { cliLoginDecider, cliLoginReader } from './cli-api.ts';
import {
  cliConnectionDisconnecter,
  cliConnectionsLoader,
} from './cli-connections-api.ts';
import { factoryLoader } from './factory-api.ts';
import { featureLoader, featuresLoader } from './features-api.ts';
import {
  frictionReportLoader,
  frictionReportMarker,
  frictionsLoader,
} from './frictions-api.ts';
import { occurrencesLoader, outputLoader } from './occurrences-api.ts';
import { collectionLoader, collectionRefresher } from './git-host-api.ts';
import { overviewLoader } from './overview-api.ts';
import { rolesLoader } from './roles-api.ts';
import { sessionLoader, sessionsLoader } from './sessions-api.ts';
import { sidebarLoader } from './sidebar-api.ts';
import { skillLoader, skillsLoader } from './skills-api.ts';
import {
  autonomyLoader,
  bugStatsLoader,
  flowLoader,
  qualityLoader,
  waitingLoader,
} from './stats-api.ts';
import { roleChanger } from './role-change-api.ts';
import {
  invitationAccepter,
  invitationActions,
  invitationReader,
  invitationsLoader,
} from './invitations-api.ts';
import { resetLinkCreator, resetReader, resetSaver } from './reset-api.ts';
import { teamLoader, withInvitations } from './team-api.ts';
import { teamCliActions } from './team-cli-api.ts';
import {
  projectAdder,
  projectRemover,
  projectSaver,
  projectsLoader,
} from './projects-api.ts';
import { activeChanger } from './account-status-api.ts';
import { roleRulesLoader, roleRulesSaver } from './role-rules-api.ts';

const gate = authGate();
const loadOverview = overviewLoader(gate.fetch);
const loadSessions = sessionsLoader(gate.fetch);
const loadSession = sessionLoader(gate.fetch);
const loadSkills = skillsLoader(gate.fetch);
const loadSkill = skillLoader(gate.fetch);
const loadRoles = rolesLoader(gate.fetch);
const loadFeatures = featuresLoader(gate.fetch);
const loadFeature = featureLoader(gate.fetch);
const loadBugs = bugsLoader(gate.fetch);
const loadFactory = factoryLoader(gate.fetch);
const loadCollection = collectionLoader(gate.fetch);
const refreshCollection = collectionRefresher(gate.fetch);
const loadAutonomy = autonomyLoader(gate.fetch);
const loadQuality = qualityLoader(gate.fetch);
const loadFrictions = frictionsLoader(gate.fetch);
const loadOccurrences = occurrencesLoader(gate.fetch);
const loadOutput = outputLoader(gate.fetch);
const loadFlow = flowLoader(gate.fetch);
const loadBugStats = bugStatsLoader(gate.fetch);
const loadWaiting = waitingLoader(gate.fetch);
const loadSidebar = sidebarLoader(gate.fetch);
const loadAuthState = authStateLoader();
const setupManager = managerSetup();
const loadMe = meLoader();
const signOut = signOuter();
const leavePage = pageLeaver();
const changeRole = roleChanger(gate.fetch);
const loadTeam = withInvitations(
  teamLoader(gate.fetch),
  invitationsLoader(gate.fetch),
);
const manageInvitations = invitationActions(gate.fetch);
const readInvitation = invitationReader();
const acceptInvitation = invitationAccepter();
const changeActive = activeChanger(gate.fetch);
const createResetLink = resetLinkCreator(gate.fetch);
const cliActions = teamCliActions(gate.fetch);
const readReset = resetReader();
const saveReset = resetSaver();
const signIn = signInSender();
const readCliLogin = cliLoginReader(gate.fetch);
const decideCliLogin = cliLoginDecider(gate.fetch);
const loadReport = frictionReportLoader(gate.fetch);
const markReport = frictionReportMarker(gate.fetch);
const loadProjects = projectsLoader(gate.fetch);
const addProject = projectAdder(gate.fetch);
const saveProject = projectSaver(gate.fetch);
const removeProject = projectRemover(gate.fetch);
const loadRoleRules = roleRulesLoader(gate.fetch);
const saveRoleRules = roleRulesSaver(gate.fetch);
const loadCliConnections = cliConnectionsLoader(gate.fetch);
const disconnectCliConnection = cliConnectionDisconnecter(gate.fetch);
const root = document.querySelector('#root');
if (root) {
  const app = (
    <App
      loadOverview={loadOverview}
      loadSessions={loadSessions}
      loadSession={loadSession}
      loadSkills={loadSkills}
      loadSkill={loadSkill}
      loadRoles={loadRoles}
      loadFeatures={loadFeatures}
      loadFeature={loadFeature}
      loadBugs={loadBugs}
      loadFactory={loadFactory}
      loadCollection={loadCollection}
      refreshCollection={refreshCollection}
      loadAutonomy={loadAutonomy}
      loadQuality={loadQuality}
      loadFrictions={loadFrictions}
      loadOccurrences={loadOccurrences}
      loadOutput={loadOutput}
      loadFlow={loadFlow}
      loadBugStats={loadBugStats}
      loadWaiting={loadWaiting}
      loadSidebar={loadSidebar}
      loadAuthState={loadAuthState}
      setupManager={setupManager}
      loadMe={loadMe}
      signOut={signOut}
      leavePage={leavePage}
      loadTeam={loadTeam}
      changeRole={changeRole}
      invitationActions={manageInvitations}
      readInvitation={readInvitation}
      acceptInvitation={acceptInvitation}
      changeActive={changeActive}
      createResetLink={createResetLink}
      cliActions={cliActions}
      readReset={readReset}
      saveReset={saveReset}
      loadReport={loadReport}
      markReport={markReport}
      loadProjects={loadProjects}
      addProject={addProject}
      saveProject={saveProject}
      removeProject={removeProject}
      loadRoleRules={loadRoleRules}
      saveRoleRules={saveRoleRules}
      loadCliConnections={loadCliConnections}
      disconnectCliConnection={disconnectCliConnection}
      signIn={signIn}
      readCliLogin={readCliLogin}
      decideCliLogin={decideCliLogin}
      sessionGate={gate}
    />
  );
  const router = createBrowserRouter([{ path: '*', element: app }]);
  createRoot(root).render(<RouterProvider router={router} />);
}
