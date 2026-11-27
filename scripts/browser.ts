import { type Browser, type Page, chromium } from 'playwright';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../src/demo/account.ts';

const LOAD_TIMEOUT_MS = 30_000;

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch().catch((error: unknown) => {
    throw new Error(
      'Could not start headless Chromium. Install it once with `pnpm exec playwright install --with-deps chromium-headless-shell` (asks for sudo for the system libraries).',
      { cause: error },
    );
  });
}

async function signIn(tab: Page, url: string): Promise<void> {
  const signInUrl = new URL('/api/auth/sign-in', url).toString();
  let response;
  try {
    response = await tab.context().request.post(signInUrl, {
      data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    });
  } catch (error) {
    throw new Error(
      `Could not load ${url}: is the server running (pnpm demo --port <n>)?`,
      { cause: error },
    );
  }
  if (!response.ok()) {
    throw new Error(
      `Could not sign in as ${DEMO_EMAIL} on ${signInUrl} (${String(response.status())}): is it a server started by pnpm demo?`,
    );
  }
}

/** Signs in as the demo manager, then loads a page until the network settles, with a clear error when the server does not answer. */
export async function openPage(tab: Page, url: string): Promise<void> {
  await signIn(tab, url);
  let response;
  try {
    response = await tab.goto(url, {
      waitUntil: 'networkidle',
      timeout: LOAD_TIMEOUT_MS,
    });
  } catch (error) {
    throw new Error(
      `Could not load ${url}: is the server running (pnpm demo --port <n>)?`,
      { cause: error },
    );
  }
  if (response !== null && !response.ok()) {
    throw new Error(`${url} answered ${String(response.status())}`);
  }
}
