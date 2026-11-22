import { type ReactElement, type ReactNode, useId } from 'react';
import './layout.css';

export interface WarningAction {
  label: string;
  onClick: () => void;
}

export interface WarningMessage {
  key: string;
  text: ReactNode;
  action?: WarningAction;
}

export interface WarningBannerProps {
  label: string;
  messages: readonly WarningMessage[];
}

function WarningIcon(): ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function WarningItem({ text, action }: WarningMessage): ReactElement {
  const textId = useId();
  return (
    <li className="fd-banner-item">
      <span className="fd-banner-message">
        <WarningIcon />
        <span id={textId}>{text}</span>
      </span>
      {action !== undefined && (
        <button
          type="button"
          className="fd-control fd-banner-action"
          aria-describedby={textId}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </li>
  );
}

export function WarningBanner({
  label,
  messages,
}: WarningBannerProps): ReactElement {
  return (
    <section className="fd-banner" aria-label={label}>
      <ul className="fd-column fd-banner-list">
        {messages.map((message) => (
          <WarningItem
            key={message.key}
            text={message.text}
            {...(message.action === undefined
              ? {}
              : { action: message.action })}
          />
        ))}
      </ul>
    </section>
  );
}
