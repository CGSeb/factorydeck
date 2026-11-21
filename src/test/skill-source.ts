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
