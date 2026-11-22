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
  variant?: 'plain' | 'headline';
  renderLink?: RenderLink;
}

export function PageHeader({
  title,
  back,
  summary,
  slot,
  variant = 'plain',
  renderLink = renderAnchor,
}: PageHeaderProps): ReactElement {
  return (
    <div className="fd-page-header" data-variant={variant}>
      <div className="fd-page-header-text">
        {back !== undefined &&
          renderLink({
            href: back.href,
            className: 'fd-back',
            children: `← ${back.label}`,
          })}
        <h1 className="fd-page-title">{title}</h1>
        {summary !== undefined && <p className="fd-page-summary">{summary}</p>}
      </div>
      {slot !== undefined && <div className="fd-page-header-slot">{slot}</div>}
    </div>
  );
}
