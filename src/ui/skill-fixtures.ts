import type {
  SkillDetail,
  SkillList,
  SkillListResponse,
  SkillResponse,
  SkillUsage,
} from '../skills/types.ts';
import type { LoadSkill, LoadSkills } from './skills-api.ts';
import { nameOf, optionsOf } from './project-fixtures.ts';
import { splitTokens } from './token-fixtures.ts';

const PROJECTS = ['/home/dev/example-app', '/home/dev/example-lib'];

export const writeSpecUsage: SkillUsage = {
  skill: 'kit:write-spec',
  launches: 4,
  sessions: 3,
  apiCalls: 120,
  tokens: 2_400_000,
  tokenCounts: splitTokens(2_400_000),
  costUsd: 3.2,
  averageCostUsd: 0.8,
};

export const reviewUsage: SkillUsage = {
  skill: 'kit:review',
  launches: 2,
  sessions: 2,
  apiCalls: 40,
  tokens: 610_000,
  tokenCounts: splitTokens(610_000),
  costUsd: 0.9,
  averageCostUsd: 0.45,
};

export const unpricedUsage: SkillUsage = {
  skill: 'deploy',
  launches: 1,
  sessions: 1,
  apiCalls: 3,
  tokens: 4_000,
  tokenCounts: splitTokens(4_000),
  costUsd: null,
  averageCostUsd: null,
};

export const noSkillUsage: SkillUsage = {
  skill: null,
  launches: 0,
  sessions: 0,
  apiCalls: 300,
  tokens: 5_100_000,
  tokenCounts: splitTokens(5_100_000),
  costUsd: 6.1,
  averageCostUsd: null,
};

export const someSkills: SkillUsage[] = [
  noSkillUsage,
  writeSpecUsage,
  reviewUsage,
  unpricedUsage,
];

function listOf(skills: SkillUsage[]): SkillList {
  return {
    skills,
    launches: skills.reduce((sum, row) => sum + row.launches, 0),
    projects: optionsOf(PROJECTS),
  };
}

export function listResponse(skills: SkillUsage[]): SkillListResponse {
  return {
    status: 'ok',
    updatedAt: '2026-01-07T09:41:05.000Z',
    refreshSeconds: 3600,
    list: listOf(skills),
  };
}

export function skillsLoader(
  all: SkillUsage[],
  inProject: SkillUsage[] = [noSkillUsage],
): LoadSkills {
  return ({ project }) =>
    Promise.resolve(listResponse(project === undefined ? all : inProject));
}

export const writeSpecDetail: SkillDetail = {
  skill: 'kit:write-spec',
  launches: 4,
  tokens: 2_400_000,
  tokenCounts: splitTokens(2_400_000),
  costUsd: 3.2,
  averageCostUsd: 0.8,
  series: [
    { day: '2026-01-05', launches: 1 },
    { day: '2026-01-06', launches: 0 },
    { day: '2026-01-07', launches: 3 },
  ],
  sessions: [
    {
      id: '7f3a9c21-0000-4000-8000-000000000001',
      title: 'Add the export button',
      project: '/home/dev/example-app',
      projectName: nameOf('/home/dev/example-app'),
      launches: 2,
      tokens: 1_900_000,
      tokenCounts: splitTokens(1_900_000),
      costUsd: 2.5,
    },
    {
      id: 'b81e44d0-0000-4000-8000-000000000002',
      title: '',
      project: '/home/dev/example-lib',
      projectName: nameOf('/home/dev/example-lib'),
      launches: 2,
      tokens: 500_000,
      tokenCounts: splitTokens(500_000),
      costUsd: 0.7,
    },
  ],
  projects: optionsOf(PROJECTS),
};

export const unlaunchedDetail: SkillDetail = {
  ...writeSpecDetail,
  launches: 0,
  tokens: 0,
  tokenCounts: splitTokens(0),
  costUsd: 0,
  averageCostUsd: null,
  series: [{ day: '2026-01-07', launches: 0 }],
  sessions: [],
};

export function skillResponse(skill: SkillDetail): SkillResponse {
  return {
    status: 'ok',
    updatedAt: '2026-01-07T09:41:05.000Z',
    refreshSeconds: 3600,
    skill,
  };
}

export function skillLoader(detail: SkillDetail): LoadSkill {
  return (name, { project }) =>
    Promise.resolve(
      skillResponse(
        project === undefined
          ? { ...detail, skill: name }
          : {
              ...detail,
              skill: name,
              sessions: detail.sessions.filter(
                (row) => row.project === project,
              ),
            },
      ),
    );
}
