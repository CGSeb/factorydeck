import { type ReactElement, useEffect, useState } from 'react';
import { fetchHealthMessage } from './health-message.ts';

export interface AppProps {
  loadHealthMessage?: () => Promise<string>;
}

/** The FactoryDeck page: its heading and the database health read once on load. */
export function App({
  loadHealthMessage = fetchHealthMessage,
}: AppProps): ReactElement {
  const [message, setMessage] = useState('');

  useEffect(() => {
    let current = true;
    void loadHealthMessage().then((loaded) => {
      if (current) setMessage(loaded);
    });
    return () => {
      current = false;
    };
  }, [loadHealthMessage]);

  return (
    <main>
      <h1>FactoryDeck</h1>
      <p>{message}</p>
    </main>
  );
}
