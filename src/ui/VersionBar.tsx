import type { ReactElement } from 'react';
import './version-bar.css';

export interface VersionBarProps {
  shown: number;
  count: number;
  onChange: (version: number) => void;
}

function Step({
  label,
  symbol,
  target,
  enabled,
  onChange,
}: {
  label: string;
  symbol: string;
  target: number;
  enabled: boolean;
  onChange: (version: number) => void;
}): ReactElement {
  return (
    <button
      type="button"
      className="fd-version-step"
      aria-label={label}
      aria-disabled={!enabled}
      onClick={() => {
        if (enabled) onChange(target);
      }}
    >
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}

export function VersionBar({
  shown,
  count,
  onChange,
}: VersionBarProps): ReactElement {
  return (
    <nav className="fd-version-bar" aria-label="Versions">
      <Step
        label="Previous version"
        symbol="‹"
        target={shown - 1}
        enabled={shown > 1}
        onChange={onChange}
      />
      <span className="fd-version-label" aria-live="polite">
        Version {shown} of {count}
      </span>
      <Step
        label="Next version"
        symbol="›"
        target={shown + 1}
        enabled={shown < count}
        onChange={onChange}
      />
    </nav>
  );
}
