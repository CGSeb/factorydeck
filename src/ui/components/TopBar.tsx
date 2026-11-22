import type { ReactElement, ReactNode } from 'react';
import { type RenderLink, renderAnchor } from './link.ts';
import './layout.css';

export interface TopBarLink {
  label: string;
  href: string;
  current: boolean;
}

export interface TopBarProps {
  links: readonly TopBarLink[];
  actions?: ReactNode;
  renderLink?: RenderLink;
}

export function TopBar({
  links,
  actions,
  renderLink = renderAnchor,
}: TopBarProps): ReactElement {
  return (
    <header className="fd-topbar">
      <div className="fd-column fd-topbar-inner">
        <span className="fd-brand">
          Factory<span className="fd-brand-accent">Deck</span>
        </span>
        <nav className="fd-topbar-nav" aria-label="Sections">
          <ul>
            {links.map((link) => (
              <li key={link.href}>
                {renderLink({
                  href: link.href,
                  className: 'fd-topbar-link',
                  ...(link.current ? { 'aria-current': 'page' } : {}),
                  children: link.label,
                })}
              </li>
            ))}
          </ul>
        </nav>
        {actions !== undefined && (
          <div className="fd-topbar-actions">{actions}</div>
        )}
      </div>
    </header>
  );
}
