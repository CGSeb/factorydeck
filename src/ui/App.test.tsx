import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';

describe('App', () => {
  it('renders the FactoryDeck heading', () => {
    const html = renderToString(
      <App loadHealthMessage={() => Promise.resolve('')} />,
    );
    expect(html).toContain('<h1>FactoryDeck</h1>');
  });
});
