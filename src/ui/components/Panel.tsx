import { type ReactElement, type ReactNode, useId } from 'react';
import { type RenderLink, renderAnchor } from './link.ts';
import './layout.css';

export interface PanelLink {
  label: string;
  href: string;
}

export interface PanelProps {
  heading?: ReactNode;
  link?: PanelLink;
  children: ReactNode;
  renderLink?: RenderLink;
}

export function Panel({
  heading,
  link,
  children,
  renderLink = renderAnchor,
}: PanelProps): ReactElement {
  const headingId = useId();
  const hasHead = heading !== undefined || link !== undefined;
  return (
    <section
      className="fd-panel"
      aria-labelledby={heading === undefined ? undefined : headingId}
    >
      {hasHead && (
        <div className="fd-panel-head">
          {heading !== undefined && (
            <h2 id={headingId} className="fd-panel-heading">
              {heading}
            </h2>
          )}
          {link !== undefined &&
            renderLink({
              href: link.href,
              className: 'fd-panel-link',
              children: link.label,
            })}
        </div>
      )}
      {children}
    </section>
  );
}
