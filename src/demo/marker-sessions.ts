import {
  type DemoSession,
  haiku,
  launching,
  opus,
  replying,
  sonnet,
} from './calls.ts';

const HOUR = 3_600_000;
export function markerSessions(
  project: string,
  day: number,
  specSkill: string,
): DemoSession[] {
  return [
    {
      id: 'demo-app-spec',
      folder: '-demo-example-app',
      project: project,
      gitBranch: 'main',
      startsAgo: 2 * day + 3 * HOUR,
      prompt: 'Write the export spec',
      calls: [
        launching(opus, specSkill),
        opus,
        replying(
          sonnet,
          `Spec written and issue opened.\n\nWork item: #31 (spec-writer)`,
        ),
      ],
    },
    {
      id: 'demo-app-specs',
      folder: '-demo-example-app',
      project: project,
      gitBranch: 'main',
      startsAgo: day + 2 * HOUR,
      prompt: 'Specs for #35',
      calls: [
        opus,
        replying(sonnet, 'Work item: #33 (spec-writer)'),
        opus,
        replying(sonnet, 'Work item: #34'),
      ],
      subAgents: [
        {
          id: 'explore',
          agentType: 'Explore',
          description: 'Explore the code',
          calls: [haiku],
        },
      ],
    },
  ];
}
