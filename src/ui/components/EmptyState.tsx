import type { ReactElement, ReactNode } from 'react';
import './layout.css';

export interface EmptyStateStep {
  key: string;
  content: ReactNode;
}

export interface EmptyStateProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  text: ReactNode;
  steps?: readonly EmptyStateStep[];
  footnote?: ReactNode;
}

export function EmptyState({
  eyebrow,
  title,
  text,
  steps,
  footnote,
}: EmptyStateProps): ReactElement {
  return (
    <div className="fd-empty">
      {eyebrow !== undefined && <p className="fd-empty-eyebrow">{eyebrow}</p>}
      <h1 className="fd-empty-title">{title}</h1>
      <p className="fd-empty-text">{text}</p>
      {steps !== undefined && steps.length > 0 && (
        <ol className="fd-empty-steps">
          {steps.map((step) => (
            <li key={step.key}>
              <div>{step.content}</div>
            </li>
          ))}
        </ol>
      )}
      {footnote !== undefined && (
        <p className="fd-empty-footnote">{footnote}</p>
      )}
    </div>
  );
}
