import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { shotTargets } from './shot-targets.ts';

const LOAD_TIMEOUT_MS = 30_000;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    port: { type: 'string', default: '4318' },
    width: { type: 'string', default: '1280' },
    height: { type: 'string', default: '900' },
    theme: { type: 'string', default: 'light' },
    out: { type: 'string' },
  },
});

const [page = '/'] = positionals;
const targets = shotTargets({
  page,
  port: values.port,
  widths: values.width,
  height: values.height,
  theme: values.theme,
  out: values.out,
});

const browser = await chromium.launch().catch((error: unknown) => {
  throw new Error(
    'Could not start headless Chromium. Install it once with `pnpm exec playwright install --with-deps chromium-headless-shell` (asks for sudo for the system libraries).',
    { cause: error },
  );
});
try {
  for (const target of targets) {
    const context = await browser.newContext({
      viewport: { width: target.width, height: target.height },
      colorScheme: target.theme,
    });
    const tab = await context.newPage();
    const errors: string[] = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    let response;
    try {
      response = await tab.goto(target.url, {
        waitUntil: 'networkidle',
        timeout: LOAD_TIMEOUT_MS,
      });
    } catch (error) {
      throw new Error(
        `Could not load ${target.url}: is the server running (pnpm demo --port <n>)?`,
        { cause: error },
      );
    }
    if (response !== null && !response.ok()) {
      throw new Error(`${target.url} answered ${String(response.status())}`);
    }
    const { innerWidth, scrollWidth } = await tab.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    await mkdir(dirname(target.file), { recursive: true });
    const pageHeight = await tab.evaluate(
      () => document.documentElement.scrollHeight,
    );
    /** A full-page screenshot keeps the viewport height, so a sticky `100vh` sidebar would end mid-page: grow the viewport to the page instead. */
    await tab.setViewportSize({
      width: target.width,
      height: Math.max(target.height, pageHeight),
    });
    await tab.waitForLoadState('networkidle');
    await tab.screenshot({ path: target.file });
    const overflow =
      scrollWidth > innerWidth
        ? `, horizontal overflow: ${String(scrollWidth)} px wide`
        : ', no horizontal overflow';
    console.log(
      `${target.file} (${String(target.width)} px, ${target.theme}${overflow})`,
    );
    for (const message of errors) console.error(`  page error: ${message}`);
    await context.close();
  }
} finally {
  await browser.close();
}
