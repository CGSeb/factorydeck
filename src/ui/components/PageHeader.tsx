import type { ReactElement, ReactNode } from 'react';
import { type RenderLink, renderAnchor } from './link.ts';
import './layout.css';

export interface PageHeaderBack {
  label: string;
  href: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  back?: PageHeaderBack;
  summary?: ReactNode;
  slot?: ReactNode;
  /** Filter rows kept in view with the title and the slot while the page scrolls. */
  controls?: ReactNode;
  variant?: 'plain' | 'headline';
  /** Keeps the summary line's height while the summary is still loading. */
  pending?: boolean;
  renderLink?: RenderLink;
}

export function PageHeader({
  title,
  back,
  summary,
  slot,
  controls,
  variant = 'plain',
  pending = false,
  renderLink = renderAnchor,
}: PageHeaderProps): ReactElement {
  const sticky = slot !== undefined || controls !== undefined;
  return (
    <div className="fd-page-header" data-variant={variant} data-sticky={sticky}>
      <div className="fd-page-header-row">
        <div className="fd-page-header-text">
          {back !== undefined &&
            renderLink({
              href: back.href,
              className: 'fd-back',
              children: `← ${back.label}`,
            })}
          <h1 className="fd-page-title">{title}</h1>
          {summary !== undefined ? (
            <p className="fd-page-summary">{summary}</p>
          ) : (
            pending && (
              <p className="fd-page-summary" aria-hidden="true">
                {'\u00a0'}
              </p>
            )
          )}
        </div>
        {slot !== undefined && (
          <div className="fd-page-header-slot">{slot}</div>
        )}
      </div>
      {controls !== undefined && (
        <div className="fd-page-header-controls">{controls}</div>
      )}
    </div>
  );
}
