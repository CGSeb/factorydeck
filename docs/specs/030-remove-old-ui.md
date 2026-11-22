# 030 · Remove the old UI

Status: ready
Depends on: 024, 026, 027, 028, 029
Checked: 2026-11-22

## User goal

A developer working on FactoryDeck after the redesign finds one set of components, one set of styles and no leftover design reference, so the next change starts from what users actually see.

## Acceptance criteria

- [ ] Every component of `src/ui` that no page or other component imports anymore is deleted with its stories and tests (expected: `UsageTiles`, `CostChart`, `LaunchChart`, `ModelTable`, `ProjectTable`, `FeatureTiles`, `FeatureTable`, `FeatureSessionTable`, `RoleTable`, `SkillTable`, `SessionTable`, `SubAgentTable`, `SessionSkillTable`, `IssuePanel`, `OutcomeLine`, `StageLabel`, `SessionStateLabel`, `TokenCount`, `PeriodSelector`, `ProjectSelect`, `CollectionStatus`, as far as none is still used).
- [ ] `recharts` is removed from `package.json` and the lockfile; nothing imports it.
- [ ] `src/ui/styles.css` keeps only rules that a remaining element uses, or is deleted if none is left; no class name in it is unused (checked by a search of each selector in `src/ui`).
- [ ] The colour check of spec 014 (`scripts/check-design-colors.ts`) covers all of `src/ui`, except `src/ui/design/` and `src/ui/colors.ts`; `pnpm lint` passes with it.
- [ ] `docs/design/` (the B4 mockups and their README) is deleted, and no spec, doc or code links to it anymore; specs 014 to 029 keep their text, with their mockup lines left as history.
- [ ] Every page and state of specs 023 to 029 looks and behaves as before this change (same stories, same screenshots).

## Rules

- Nothing user-visible changes in this spec.
- `src/ui/colors.ts` stays if its contrast helpers are still used (spec 014's contrast test uses them).

## Expected proof

- `pnpm check` passes; `pnpm build` and the bundle size before and after are given in the pull request.
- `grep -r recharts src package.json` returns nothing; `ls docs/design` fails.
- On the real app, with `pnpm demo`: screenshots of each page at 1280 px, attached to the pull request.

## Out of scope

- Any visual or behavioural change.
- A dark theme or new components.
