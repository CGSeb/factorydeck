import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './design/tokens.css';
import './design/theme-dark.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App.tsx';
import { bugsLoader } from './bugs-api.ts';
import { factoryLoader, projectDeleter } from './factory-api.ts';
import { featureLoader, featuresLoader } from './features-api.ts';
import { frictionsLoader } from './frictions-api.ts';
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

const loadOverview = overviewLoader();
const loadSessions = sessionsLoader();
const loadSession = sessionLoader();
const loadSkills = skillsLoader();
const loadSkill = skillLoader();
const loadRoles = rolesLoader();
const loadFeatures = featuresLoader();
const loadFeature = featureLoader();
const loadBugs = bugsLoader();
const loadFactory = factoryLoader();
const deleteProject = projectDeleter();
const loadCollection = collectionLoader();
const refreshCollection = collectionRefresher();
const loadAutonomy = autonomyLoader();
const loadQuality = qualityLoader();
const loadFrictions = frictionsLoader();
const loadOccurrences = occurrencesLoader();
const loadOutput = outputLoader();
const loadFlow = flowLoader();
const loadBugStats = bugStatsLoader();
const loadWaiting = waitingLoader();
const loadSidebar = sidebarLoader();
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
      />
    </BrowserRouter>,
  );
}
