import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './design/tokens.css';
import './design/theme-dark.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
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
import { factoryLoader, projectDeleter } from './factory-api.ts';
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
import { teamLoader } from './team-api.ts';

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
const deleteProject = projectDeleter(gate.fetch);
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
const loadTeam = teamLoader(gate.fetch);
const signIn = signInSender();
const loadReport = frictionReportLoader(gate.fetch);
const markReport = frictionReportMarker(gate.fetch);
const root = document.querySelector('#root');
if (root) {
  createRoot(root).render(
    <BrowserRouter>
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
        deleteProject={deleteProject}
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
        loadReport={loadReport}
        markReport={markReport}
        signIn={signIn}
        sessionGate={gate}
      />
    </BrowserRouter>,
  );
}
