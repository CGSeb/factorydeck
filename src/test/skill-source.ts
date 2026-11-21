import type { SkillSource } from '../server/skill-routes.ts';

export const unusedSkills: SkillSource = {
  list: () => Promise.reject(new Error('Not used')),
  detail: () => Promise.reject(new Error('Not used')),
};
