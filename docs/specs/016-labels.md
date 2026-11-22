# 016 · Labels

Status: ready
Depends on: 014
Checked: 2026-11-22

## User goal

A developer scanning FactoryDeck recognises at a glance an issue's stage, a session's state, a review outcome, a project and a role, each always with its text so colour is never the only cue. This spec builds those small labels in Storybook.

## Acceptance criteria

- [ ] `src/ui/components/StageBadge.tsx`: a pill (radius `--fd-radius-pill`, 12 px text, weight 600, padding 3 px 9 px, no wrapping) with the stage text of spec 009 (`Merged`, `Merged by a person`, `Closed without merge`, `Blocked`, `Needs spec`, `In review`, `Working`, `Ready`, `Open`), coloured with the tone of spec 009's rules: success for `Merged` and `Merged by a person`, danger for `Closed without merge` and `Blocked`, warning for `Needs spec`, neutral for the others.
- [ ] `src/ui/components/StageDot.tsx`: an 8 px round dot for a stage group, with no text of its own (`aria-hidden`): `--fd-stage-ready` for `Ready`, `--fd-stage-working`, `--fd-stage-review` and `--fd-stage-merged` for the other three groups of spec 024.
- [ ] `src/ui/components/SessionStateBadge.tsx`: a pill with a 7 px dot then the state text of spec 004: `Working` (info tone, dot `--fd-stage-working`), `Waiting for you` (warning tone, dot `--fd-stage-review`), `Inactive` (neutral tone, dot `--fd-stage-ready`).
- [ ] `src/ui/components/SerenityBadge.tsx` takes a score and a threshold (spec 009): at or above the threshold, a success pill `serenity <score>`; below it, a warning pill `serenity <score> · below threshold`. With no report, it renders nothing.
- [ ] `src/ui/components/RoundsBadge.tsx` takes a number of review rounds: a warning pill `round <r>` for an issue still in review (prop `inReview`), else a neutral pill `1 review round` or `<r> review rounds`; with no rounds known, nothing.
- [ ] `src/ui/components/ProjectTag.tsx` takes a project root, its display name and its colour: an 8 px square dot (radius 2 px) of that colour, then the display name (spec 012, including its 60-character cut and `(<root>)` suffix for duplicated names), in `--fd-ink-2`. Its tooltip (`title`) is the root path; for `unassigned`, no tooltip and no dot.
- [ ] `src/ui/components/RoleTag.tsx` takes a role and its colour: a 9 px square dot (radius 3 px) of that colour, then the role name; `unassigned` is shown in `--fd-muted` and italics.
- [ ] Storybook stories: `StageBadge` with all nine stages, `StageDot` with the four groups, `SessionStateBadge` with the three states, `SerenityBadge` above and below threshold, `RoundsBadge` in review and merged with 1 and 3 rounds, `ProjectTag` (short name, 60-character name cut, duplicated name, `unassigned`), `RoleTag` (a role, `Orchestration`, `unassigned`). They pass the axe check of `src/ui/stories.test.tsx`.

## Rules

- Every label shows its meaning as text; colours are the tokens of spec 014 only.
- The colour of a project or role is given by the caller (`projectColors` and `roleColors` of spec 014); the labels never pick a colour from a name.
- Existing `StageLabel` and `SessionStateLabel` stay until spec 030.

## Expected proof

- The stories above pass axe, including the contrast of each tone in Storybook's own accessibility panel.
- A screenshot of the `StageBadge` and `ProjectTag` stories, attached to the pull request.

## Out of scope

- Using the labels on pages (specs 023 to 029).
- New stages or states; their rules stay those of specs 004 and 009.
