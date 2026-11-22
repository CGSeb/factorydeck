import type { ReactElement, ReactNode } from 'react';
import { Icon, type IconName } from './Icon.tsx';
import { type RenderLink, renderAnchor } from './link.ts';
import type { Tip, TipHandlers } from './sidebar-state.ts';
import './controls.css';
import './layout.css';
import './sidebar.css';

export interface SidebarLink {
  label: string;
  href: string;
  current: boolean;
  icon: IconName;
}

export interface ProjectSlotControl {
  defaultOpen: boolean;
  onClose: (() => void) | undefined;
}

export interface SidebarProject {
  label: string;
  render: (control: ProjectSlotControl) => ReactNode;
}

export interface SidebarRefresh {
  tip: string;
  render: (compact: boolean) => ReactNode;
}

export interface SidebarProps {
  links: readonly SidebarLink[];
  renderLink?: RenderLink;
  project?: SidebarProject | undefined;
  refresh?: SidebarRefresh | undefined;
}

export type TipFor = (text: string) => TipHandlers | undefined;

export const NO_TIP: TipFor = () => undefined;

export function Brand({ folded }: { folded: boolean }): ReactElement {
  return folded ? (
    <span className="fd-brand fd-brand-mono">
      <span aria-hidden="true">FD</span>
      <span className="fd-visually-hidden">FactoryDeck</span>
    </span>
  ) : (
    <span className="fd-brand">
      Factory<span className="fd-brand-accent">Deck</span>
    </span>
  );
}

export function SidebarTip({
  tip,
}: {
  tip: Tip | undefined;
}): ReactElement | null {
  if (tip === undefined) return null;
  return (
    <span
      className="fd-sidebar-tip"
      role="tooltip"
      aria-hidden="true"
      style={{ top: tip.top, left: tip.left }}
    >
      {tip.text}
    </span>
  );
}

function SidebarNav({
  links,
  renderLink,
  folded,
  tipFor,
}: {
  links: readonly SidebarLink[];
  renderLink: RenderLink;
  folded: boolean;
  tipFor: TipFor;
}): ReactElement {
  return (
    <nav className="fd-sidebar-nav" aria-label="Sections">
      <ul>
        {links.map((link) => (
          <li key={link.href} {...tipFor(link.label)}>
            {renderLink({
              href: link.href,
              className: 'fd-sidebar-link',
              ...(link.current ? { 'aria-current': 'page' } : {}),
              children: (
                <>
                  <Icon name={link.icon} />
                  <span
                    className={
                      folded ? 'fd-visually-hidden' : 'fd-sidebar-label'
                    }
                  >
                    {link.label}
                  </span>
                </>
              ),
            })}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export interface PanelProps extends SidebarProps {
  id?: string | undefined;
  folded: boolean;
  tipFor: TipFor;
  top?: ReactNode;
  projectSlot: ReactNode;
  bottom?: ReactNode;
}

export function SidebarPanel({
  id,
  links,
  renderLink = renderAnchor,
  refresh,
  folded,
  tipFor,
  top,
  projectSlot,
  bottom,
}: PanelProps): ReactElement {
  return (
    <aside id={id} className="fd-sidebar" data-folded={folded}>
      <div className="fd-sidebar-brand">
        <Brand folded={folded} />
        {top}
      </div>
      {projectSlot}
      <SidebarNav
        links={links}
        renderLink={renderLink}
        folded={folded}
        tipFor={tipFor}
      />
      <div className="fd-sidebar-bottom">
        {refresh !== undefined && (
          <div className="fd-sidebar-refresh" {...tipFor(refresh.tip)}>
            {refresh.render(folded)}
          </div>
        )}
        {bottom}
      </div>
    </aside>
  );
}
