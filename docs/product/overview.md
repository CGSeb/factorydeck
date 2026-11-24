# Overview

The home page, `/`: what the factory delivered in the period and what it used in tokens. It reads `/api/overview`, `/api/features` and `/api/roles` for the period and project.

## Header

`<n> issues merged for <tokens> tokens` (`1 issue merged for …`; with none, `No issue merged · <tokens> tokens`), where `<n>` counts the [merged issues](outcomes.md#stages) with a call in the period. The summary line reads `<t> tokens per merged issue · <m> of <n> merged without a person · <s> sessions`, the first two parts left out with no merged issue. The header is titled `Overview` until its figures arrive.

## Board

Four columns side by side (at least 250 px each, wrapping below): `Ready`, `Working`, `In review`, `Merged`, the [board groups](outcomes.md#stages) of the issues of `/features` for the same period and project. Issues closed without merge, not found or not collected are not on the board.

- Each column shows its number of issues and their tokens, and its 5 issues with the latest activity, most recent first; with more, `+ <k> more` links to `/features?stage=<group>` with the project and period.
- A card shows its project only with `All projects`, and its badges: in `Ready`, its stage when it is not `Ready`; in `In review`, its review rounds when its report has some; in `Merged`, its serenity score, plus `by a person` or `after a person` for those stages. A card links to its issue page with the period.

## Where the tokens went

A panel with a link `Roles` to `/roles`: the period's tokens split by role, with a legend and an amount per role, and next to it (under it below 680 px) `Tokens per day` (`Tokens per hour` for `Today`) as bars.

## Empty and loading

With no call in the period, the header reads `No issue merged · 0 tokens` and `No activity in this period.` replaces the board and the panel. The header, the board and the panel each load and fail on their own.
