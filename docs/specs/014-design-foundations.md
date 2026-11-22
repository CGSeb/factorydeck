# 014 · Design foundations

Status: ready
Depends on: none
Checked: 2026-11-22

## User goal

A developer building the new FactoryDeck interface (design B4, `docs/design/`) takes every colour, font, size and spacing from one set of design tokens, sees them in Storybook, and cannot slip a stray colour into the new components. This is the first step of the redesign: no page changes yet.

## Acceptance criteria

- [ ] `src/ui/design/tokens.css` defines the tokens below as CSS custom properties on `:root`, with exactly these names and values. It is imported once by the UI entry point and by Storybook's preview.
  - Text: `--fd-ink: #17201f`, `--fd-ink-2: #3c4846`, `--fd-muted: #55625f`.
  - Surfaces: `--fd-page: #f3f5f4`, `--fd-surface: #ffffff`, `--fd-surface-2: #f6f8f7`, `--fd-overlay: rgba(16, 24, 23, 0.45)`.
  - Lines: `--fd-border: #dfe5e3`, `--fd-border-2: #e3e9e7`, `--fd-line: #edf1ef`, `--fd-field-border: #cfd8d5`.
  - Accent: `--fd-accent: #0f766e`, `--fd-accent-soft: #e3eeeb`, `--fd-accent-ink: #0b3f3a`, `--fd-link: #0b5f58`, `--fd-link-hover: #063f3a`.
  - Tones, each a background and a text colour: `--fd-success-bg: #e2f3ec` / `--fd-success: #14593a`, `--fd-warning-bg: #fdf0dc` / `--fd-warning: #7d4500`, `--fd-info-bg: #e7edf9` / `--fd-info: #25438a`, `--fd-danger-bg: #fbe6e6` / `--fd-danger: #8f1d1d`, `--fd-neutral-bg: #eef1f0` / `--fd-neutral: #3c4846`; `--fd-danger-strong: #a1291f` (filled danger button); `--fd-banner-border: #f0d6a8`, `--fd-banner-ink: #4d2c00`.
  - Stage dots: `--fd-stage-ready: #8a9592`, `--fd-stage-working: #2f5fb3`, `--fd-stage-review: #c27a12`, `--fd-stage-merged: #1f8a5b`.
  - Token kinds: `--fd-kind-cache-read: #0f766e`, `--fd-kind-cache-write: #5fb3a6`, `--fd-kind-input: #b9d8d2`, `--fd-kind-output: #17201f`.
  - Tooltip: `--fd-tooltip-bg: #17201f`, `--fd-tooltip-ink: #ffffff`, `--fd-tooltip-muted: #b9c4c1`, `--fd-tooltip-line: #3a4644`.
  - Fonts: `--fd-font-body: 'Inter Variable', system-ui, sans-serif`, `--fd-font-display: 'Space Grotesk Variable', 'Inter Variable', system-ui, sans-serif`, `--fd-font-mono: ui-monospace, 'SFMono-Regular', Menlo, monospace`.
  - Type sizes: `--fd-text-xs: 12px`, `--fd-text-sm: 13px`, `--fd-text-md: 14px`, `--fd-text-lg: 15px`, `--fd-title-sm: 18px`, `--fd-title-md: 28px`, `--fd-title-lg: 32px`, `--fd-figure: 40px`.
  - Spacing: `--fd-space-1: 4px` to `--fd-space-8: 32px` in steps of 4 px (`--fd-space-2: 8px`, …, `--fd-space-7: 28px`).
  - Radii: `--fd-radius-sm: 6px`, `--fd-radius-card: 10px`, `--fd-radius-panel: 14px`, `--fd-radius-aside: 16px`, `--fd-radius-dialog: 18px`, `--fd-radius-pill: 999px`.
  - Layout: `--fd-page-max: 1360px`, `--fd-gutter: 24px`, `--fd-topbar-height: 60px`, `--fd-control-height: 40px`.
- [ ] The fonts are the npm packages `@fontsource-variable/inter` and `@fontsource-variable/space-grotesk`, added as dependencies and imported by the UI entry point and Storybook's preview, so they are bundled by Vite and served by FactoryDeck itself. No page loads anything from Google Fonts or another host.
- [ ] `src/ui/design/palette.ts` exports `categoryColor(index: number): string`, which returns, from index 0, `#0f766e`, `#c27a12`, `#b4442c`, `#3d8bd4`, `#7c9a5a`, `#8a6fb8`, `#b5582a`, `#2f8f9d`, then starts again; `projectColor(index: number): string`, which returns `#7c3aed`, `#c2410c`, `#2f5fb3`, `#0f766e`, `#b45309`, `#be185d`, `#4d7c0f`, `#0369a1`, then starts again; and the constants `ORCHESTRATION_COLOR = '#5b6b8c'` and `UNASSIGNED_COLOR = '#a9b3b0'`. A negative or non-integer index is treated as 0.
- [ ] `src/ui/design/palette.ts` exports `roleColors(roles: string[]): Map<string, string>`: the orchestration role of spec 010 gets `ORCHESTRATION_COLOR`, `unassigned` (spec 006) gets `UNASSIGNED_COLOR`, and every other role gets `categoryColor` by its position among those other roles in the given order. It also exports `projectColors(projects: string[]): Map<string, string>`, by position with `projectColor`. Callers pass roles in the order of the role configuration (spec 006 and 011) and projects in the order of the project select (spec 012); the colour never depends on a name.
- [ ] Storybook has a `Design/Foundations` section with stories `Colours` (every colour token as a swatch with its name and value), `Type` (each font and size with a sample line), `Spacing and radii`, and `Palettes` (the first 10 colours of `categoryColor` and `projectColor`, plus orchestration and unassigned).
- [ ] New components of the redesign live in `src/ui/components/`. A check, `scripts/check-design-colors.ts`, run by `pnpm lint`, fails when a file of `src/ui/components/` (`.ts`, `.tsx`, `.css`) holds a colour literal (`#` followed by 3, 4, 6 or 8 hex digits, `rgb(`, `rgba(`, `hsl(`, `hsla(`), and prints each file and line. `src/ui/design/` is the only place colours are written. Stories (`*.stories.tsx`) are checked too.
- [ ] Every text and background pair the tokens name together (each tone's text on its background, `--fd-ink`, `--fd-ink-2` and `--fd-muted` on `--fd-page`, `--fd-surface` and `--fd-surface-2`, `--fd-link` on `--fd-surface`, `--fd-tooltip-ink` and `--fd-tooltip-muted` on `--fd-tooltip-bg`, white on `--fd-accent` and `--fd-danger-strong`) has a contrast ratio of at least 4.5:1, checked by a Vitest test with `contrastRatio` of `src/ui/colors.ts`.

## Rules

- These are the values of the validated mockups of `docs/design/b4/`. The design is light only; a dark theme is not part of this redesign.
- Existing components and `src/ui/styles.css` are left as they are; pages move to the new tokens in specs 023 to 029, and spec 030 removes what is left of the old styles.
- Figures in the new components use `font-variant-numeric: tabular-nums`.

## Expected proof

- Vitest tests of `categoryColor`, `projectColor` (wrap-around, index 0 for a negative or fractional index), `roleColors` and `projectColors` (orchestration, unassigned, order), of the contrast pairs, and of `scripts/check-design-colors.ts` on synthetic files (each colour form caught, a file outside `src/ui/components/` ignored).
- The `Design/Foundations` stories pass the axe check of `src/ui/stories.test.tsx`.
- `pnpm build`, then the built UI fetches its fonts from FactoryDeck's own address only (the network panel of the browser shows no other host); a screenshot of the `Type` story is attached to the pull request.

## Out of scope

- Any change to a page or an existing component.
- A dark theme, a theme switch, user-chosen colours.
- Generating the tokens from another format (JSON, Style Dictionary).
