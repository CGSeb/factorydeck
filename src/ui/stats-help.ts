export const FIGURE_HELP = {
  'Merged without a person':
    'Share of the issues merged in the period that the factory merged on its own: no spec question, no refused serenity report, no person merging.',
  'Spec questions':
    'Share of the merged issues whose agents stopped to ask a spec question (the needs-spec label) before the merge.',
  'Waiting for a person':
    'Median time the factory waited once it stopped, on a refused serenity report or a spec question, until the next report, the merge or the close.',
  'Right the first time':
    'Share of the merged issues whose first serenity report already allowed the merge: score at or above the threshold and every gate passed.',
  'Review rounds':
    'Mean number of review rounds in the serenity report that decided each merge.',
  'Score gain':
    "Mean change of the serenity score between an issue's first report and its last one before the merge.",
  'Lead time':
    "Median time from an issue's creation to its merge, including the time it waited before any agent started.",
  'Cycle time':
    'Median time from the first agent call on an issue to its merge: how long the agents took once they started.',
  'Tokens per merged issue':
    'Median tokens a merged issue used over its whole life, its share of the orchestration included.',
  'Tokens on dropped work':
    "Share of the period's tokens spent on issues that were closed without a merge.",
  'No work item':
    "Share of the period's tokens spent in threads tied to no issue.",
  'Tokens on rework':
    "Share of the period's tokens spent on an issue after its first refused serenity report: the cost of fixing work the review sent back.",
  'Time to fix':
    "Median time from a bug's creation to its merge, including the time it waited before any agent started.",
  'Bugs in delivered work':
    'Share of the issues merged in the period that are bugs.',
  'Reopened bugs':
    'Share of the bugs merged in the period that were reopened at least once.',
  'Bugs reported':
    'Number of times a bug was opened in the period: each creation and each reopening counts.',
} as const;

export const MERGED_NOUN = { one: 'merged issue', other: 'merged issues' };

export const REPORTED_NOUN = {
  one: 'merged issue with a report',
  other: 'merged issues with a report',
};
