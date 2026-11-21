import { type ReactElement, Suspense, use } from 'react';

export interface AppProps {
  /** The database health sentence, read once when the page loads. */
  healthMessage: Promise<string>;
}

function DatabaseStatus({ healthMessage }: AppProps): ReactElement {
  return <p>{use(healthMessage)}</p>;
}

/** The FactoryDeck page: its heading and the database health. */
export function App({ healthMessage }: AppProps): ReactElement {
  return (
    <main>
      <h1>FactoryDeck</h1>
      <Suspense fallback={<p />}>
        <DatabaseStatus healthMessage={healthMessage} />
      </Suspense>
    </main>
  );
}
