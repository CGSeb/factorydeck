import { parseArgs } from 'node:util';
import type { Locator, Page } from 'playwright';
import { launchBrowser, openPage } from './browser.ts';
import { pageUrl } from './shot-targets.ts';
import {
  type Frame,
  type Sample,
  describeMoves,
  movesOf,
} from './shift-report.ts';

const WATCHED = {
  title: 'main h1',
  pills: '[role="group"][aria-label="Period"]',
  panel: 'main .fd-panel, main table',
} as const;
const PAGE_ELEMENTS = Object.keys(WATCHED);
const HEADER_ELEMENTS = ['title', 'pills'];

interface Recording {
  frames: Frame[];
  on: boolean;
}

declare global {
  interface Window {
    factorydeckShift?: Recording;
  }
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    port: { type: 'string', default: '4318' },
    width: { type: 'string', default: '1280' },
    duration: { type: 'string', default: '2000' },
  },
});

const port = Number(values.port);
const width = Number(values.width);
const duration = Number(values.duration);
for (const [name, value] of [
  ['--port', port],
  ['--width', width],
  ['--duration', duration],
] as const) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
}
const url = pageUrl(positionals[0] ?? '/', port);

/** Starts recording the top of each watched element on every animation frame, and returns where they are now. */
async function startRecording(tab: Page): Promise<Sample> {
  return tab.evaluate((watched) => {
    function sample(): Sample {
      return Object.fromEntries(
        Object.entries(watched).map(([name, selector]) => [
          name,
          document.querySelector(selector)?.getBoundingClientRect().top ?? null,
        ]),
      );
    }
    performance.clearResourceTimings();
    const state: Recording = { frames: [], on: true };
    window.factorydeckShift = state;
    function tick(at: number): void {
      if (!state.on) return;
      state.frames.push({ at, tops: sample() });
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return sample();
  }, WATCHED);
}

/** Stops recording once the data has settled; `dataAt` is when the last request the action made ended. */
async function stopRecording(
  tab: Page,
): Promise<{ frames: Frame[]; dataAt: number | null }> {
  await tab.waitForTimeout(duration);
  await tab.waitForLoadState('networkidle');
  return tab.evaluate(() => {
    const state = window.factorydeckShift;
    if (state !== undefined) state.on = false;
    const ends = performance
      .getEntriesByType('resource')
      .filter(
        (entry): entry is PerformanceResourceTiming =>
          entry instanceof PerformanceResourceTiming &&
          (entry.initiatorType === 'fetch' ||
            entry.initiatorType === 'xmlhttprequest'),
      )
      .map((entry) => entry.responseEnd);
    return {
      frames: state?.frames ?? [],
      dataAt: ends.length === 0 ? null : Math.max(...ends),
    };
  });
}

async function check(
  tab: Page,
  action: string,
  target: Locator,
  elements: readonly string[],
): Promise<boolean> {
  const before = await startRecording(tab);
  await target.click();
  const { frames, dataAt } = await stopRecording(tab);
  const moves = movesOf(before, frames, elements, dataAt);
  console.log(describeMoves(action, frames.length, moves));
  return moves.every(({ beforeData }) => !beforeData);
}

const browser = await launchBrowser();
let shifted = false;
try {
  const tab = await browser.newPage({ viewport: { width, height: 900 } });
  await openPage(tab, url);
  const pills = tab.locator(`${WATCHED.pills} button`);
  const labels = await pills.allTextContents();
  if (labels.length === 0) console.log(`no period pills on ${url}`);
  for (const label of labels) {
    const pill = pills.filter({ hasText: label });
    if ((await pill.getAttribute('aria-pressed')) === 'true') continue;
    if (!(await check(tab, `Period: ${label}`, pill, PAGE_ELEMENTS))) {
      shifted = true;
    }
  }
  const nav = tab.locator('nav[aria-label="Sections"]');
  const here = nav.locator('a[aria-current="page"]');
  const away = nav.locator('a:not([aria-current])').first();
  if ((await here.count()) === 1 && (await away.count()) === 1) {
    const awayLabel = (await away.textContent()) ?? 'another page';
    const hereLabel = (await here.textContent()) ?? 'this page';
    const hereHref = await here.getAttribute('href');
    if (!(await check(tab, `To ${awayLabel}`, away, HEADER_ELEMENTS))) {
      shifted = true;
    }
    const back = nav.locator(`a[href="${hereHref ?? ''}"]`);
    if (!(await check(tab, `Back to ${hereLabel}`, back, HEADER_ELEMENTS))) {
      shifted = true;
    }
  } else {
    console.log(`no sidebar link to leave ${url} and come back`);
  }
} finally {
  await browser.close();
}
if (shifted) process.exitCode = 1;
