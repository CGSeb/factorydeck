# 033 · Dark theme

Status: done
Depends on: 014, 031
Checked: 2026-11-22

## User goal

A developer who keeps FactoryDeck open next to a dark editor or terminal reads it in a dark theme, either because their system is set to dark or because they chose it in the sidebar, and finds it the same way on their next visit.

## Acceptance criteria

- [x] `src/ui/design/theme-dark.css` redefines, under `:root[data-theme='dark']` and nothing else, every colour token of `src/ui/design/tokens.css` plus `--fd-shadow-pop` and `--fd-shadow-tooltip`, and sets `color-scheme: dark`. No other token changes, and no component CSS names a colour of its own.
- [x] In the dark theme, every text and background pair checked for the light theme in `tokens.test.ts` reaches 4.5:1, plus `--fd-banner-ink` on `--fd-warning-bg`, `--fd-accent-ink` on `--fd-accent-soft`, and `--fd-surface` as text on `--fd-ink` (pressed pills) and on `--fd-danger-strong` (danger buttons).
- [x] The theme is one of `system`, `light` or `dark`. `system` follows `prefers-color-scheme` and switches live when the device changes it. The choice is kept in `localStorage` under `factorydeck.theme` (`light` or `dark`; the key is removed for `system`); a missing or unknown value, or a throwing `localStorage`, means `system`.
- [x] The resolved theme is written to `data-theme` on the `html` element by an inline script in the `head` of `src/ui/index.html`, before the first paint, so a dark page never flashes light on load.
- [x] The sidebar shows a theme button in its bottom row, before the fold button: icon `monitor`, `sun` or `moon` for the current choice, accessible name `Theme: System`, `Theme: Light` or `Theme: Dark`. Each activation moves to the next choice (system, light, dark, then system). Expanded and in the drawer it shows the choice's name beside the icon; folded, it is a 40 px icon button with its accessible name in a tooltip, like the links.
- [x] Storybook has a `Theme` toolbar (System, Light, Dark) that applies the theme to every story, so the colour contrast of each component can be checked in both themes.
- [x] Storybook stories: `SidebarPanel` with the dark choice, `Sidebar` cycling through the three choices (checking `data-theme` and `localStorage`), the folded theme tooltip, and the theme button inside the drawer. All pass the axe check of `src/ui/stories.test.tsx`.

## Rules

- The bars of the overview's `Tokens per day` chart use `--fd-chart-bar`: `#17201f` in the light theme, as before, and a muted teal `#2f7f76` in the dark theme, so they do not outshine the rest of the card.
- The chart palettes of `src/ui/design/palette.ts` stay the same in both themes: they are mid-tone colours that read on both backgrounds, and `labelTextColor` picks the text on them.
- The theme is a per-browser comfort setting, never sent to the server.

## Expected proof

- Unit tests of the theme choice and of the dark token contrasts.
- On the real app, with `pnpm demo`: screenshots of the overview, the features page and a session page in the dark theme at 1280 px.

## Out of scope

- A per-project or per-page theme, a high-contrast theme, user-defined colours.
