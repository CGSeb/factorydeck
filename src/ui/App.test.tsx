import { prerender } from 'react-dom/static';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';
import { fetchHealthMessage } from './health-message.ts';

async function renderPage(status: number): Promise<string> {
  const answering: typeof fetch = () =>
    Promise.resolve(new Response('{}', { status }));
  const { prelude } = await prerender(
    <App healthMessage={fetchHealthMessage(answering)} />,
  );
  return new Response(prelude).text();
}

describe('App', () => {
  it('shows the heading and a connected database', async () => {
    const html = await renderPage(200);
    expect(html).toContain('<h1>FactoryDeck</h1>');
    expect(html).toContain('<p>Database connected.</p>');
  });

  it('shows an unreachable database', async () => {
    expect(await renderPage(503)).toContain(
      '<p>Database unreachable. Start it with pnpm db:up.</p>',
    );
  });
});
