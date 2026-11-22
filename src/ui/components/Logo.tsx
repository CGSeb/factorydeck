import type { ReactElement } from 'react';

/** The FactoryDeck mark: a factory inside an app window. Decorative, so a label must sit next to it. */
export function Logo(): ReactElement {
  return (
    <svg
      className="fd-logo"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="4" width="28" height="24" rx="4" fill="var(--fd-accent)" />
      <circle cx="6" cy="7" r="1" fill="var(--fd-surface)" />
      <circle cx="9" cy="7" r="1" fill="var(--fd-surface)" />
      <circle cx="12" cy="7" r="1" fill="var(--fd-surface)" />
      <rect
        x="4"
        y="10"
        width="24"
        height="16"
        rx="2"
        fill="var(--fd-surface)"
      />
      <path d="M7 24V18l4-2.5V18l4-2.5V18h4v-6h3v12z" fill="var(--fd-accent)" />
    </svg>
  );
}
