import { useEffect, useRef, type ReactElement } from 'react';
import { AuthBrand } from './SignInPage.tsx';
import './components/controls.css';
import './components/layout.css';
import './shell.css';
import './setup-page.css';

export const RETRY = 'Retry';
export const RETRYING = 'Retrying…';

export interface UnreachableScreenProps {
  message: string;
  retrying: boolean;
  onRetry: () => void;
}

export function UnreachableScreen({
  message,
  retrying,
  onRetry,
}: UnreachableScreenProps): ReactElement {
  const button = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    button.current?.focus();
  }, []);
  return (
    <main className="fd-setup">
      <section
        className="fd-setup-card"
        aria-label="FactoryDeck unavailable"
        aria-busy={retrying}
      >
        <AuthBrand />
        <p className="fd-auth-unreachable" role="alert">
          {message}
        </p>
        <button
          ref={button}
          type="button"
          className="fd-control fd-setup-submit"
          aria-disabled={retrying}
          onClick={() => {
            if (!retrying) onRetry();
          }}
        >
          {retrying ? RETRYING : RETRY}
        </button>
      </section>
    </main>
  );
}
