import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { launchBrowser, openPage } from './browser.ts';
import { shotTargets } from './shot-targets.ts';

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

const browser = await launchBrowser();
try {
  for (const target of targets) {
    const context = await browser.newContext({
      viewport: { width: target.width, height: target.height },
      colorScheme: target.theme,
    });
    const tab = await context.newPage();
    const errors: string[] = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    await openPage(tab, target.url);
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
