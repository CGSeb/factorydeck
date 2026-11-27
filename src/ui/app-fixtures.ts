import { bugStatsLoaderOf } from './stats-bug-fixtures.ts';
import {
  collectionLoaderOf,
  collectionResponse,
  refresherOf,
} from './git-host-fixtures.ts';
import { bugsLoaderOf } from './bug-fixtures.ts';
import {
  deleterOf,
  factoryLoaderOf,
  factoryResponse,
} from './factory-fixtures.ts';
import { featureLoaderOf } from './feature-detail-fixtures.ts';
import { featuresLoaderOf, someFeatures } from './feature-fixtures.ts';
import { fixedLoader, okResponse, weekOverview } from './fixtures.ts';
import { waitingLoaderOf } from './waiting-fixtures.ts';
import { rolesLoader, someRoles } from './role-fixtures.ts';
import {
  detailLoader,
  detailResponse,
  listLoader,
  sessionWithSubAgents,
  someSessions,
} from './session-fixtures.ts';
import {
  skillLoader,
  skillsLoader,
  someSkills,
  writeSpecDetail,
} from './skill-fixtures.ts';
import { flowLoaderOf } from './flow-fixtures.ts';
import { autonomyLoaderOf, qualityLoaderOf } from './stats-fixtures.ts';
import { frictionsLoaderOf } from './frictions-fixtures.ts';
import { occurrencesLoaderOf, outputLoaderOf } from './occurrence-fixtures.ts';

export const loaders = {
  loadOverview: fixedLoader(() => okResponse(weekOverview)),
  loadSessions: listLoader(someSessions),
  loadSession: detailLoader(detailResponse(sessionWithSubAgents)),
  loadSkills: skillsLoader(someSkills),
  loadSkill: skillLoader(writeSpecDetail),
  loadRoles: rolesLoader(someRoles),
  loadFeatures: featuresLoaderOf(someFeatures),
  loadFeature: featureLoaderOf(),
  loadBugs: bugsLoaderOf(),
  loadFactory: factoryLoaderOf(factoryResponse()),
  deleteProject: deleterOf('deleted'),
  loadCollection: collectionLoaderOf(collectionResponse()),
  refreshCollection: refresherOf(collectionResponse()),
  loadAutonomy: autonomyLoaderOf(),
  loadQuality: qualityLoaderOf(),
  loadFrictions: frictionsLoaderOf(),
  loadOccurrences: occurrencesLoaderOf(),
  loadOutput: outputLoaderOf(),
  loadFlow: flowLoaderOf(),
  loadBugStats: bugStatsLoaderOf(),
  loadWaiting: waitingLoaderOf(),
};
