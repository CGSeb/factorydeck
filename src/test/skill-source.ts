import type { FeatureSource } from '../server/feature-routes.ts';
import type { GitHostSource } from '../server/git-host-routes.ts';
import type { ProjectSource } from '../server/project-routes.ts';
import type { RoleSource } from '../server/role-routes.ts';
import type { SkillSource } from '../server/skill-routes.ts';

export const unusedSkills: SkillSource = {
  list: () => Promise.reject(new Error('Not used')),
  detail: () => Promise.reject(new Error('Not used')),
};

export const unusedRoles: RoleSource = {
  list: () => Promise.reject(new Error('Not used')),
  config: { path: '/configs/factorydeck.yml', exists: false },
};

export const unusedProjects: ProjectSource = {
  factoryStatus: () => Promise.reject(new Error('Not used')),
  remove: () => Promise.reject(new Error('Not used')),
};

export const unusedGitHost: GitHostSource = {
  status: () => Promise.reject(new Error('Not used')),
  refresh: () => Promise.reject(new Error('Not used')),
};

export const unusedFeatures: FeatureSource = {
  list: () => Promise.reject(new Error('Not used')),
  detail: () => Promise.reject(new Error('Not used')),
};
