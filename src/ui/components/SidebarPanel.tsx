import type { ReactElement, ReactNode } from 'react';
import { THEME_LABELS, type Theme } from '../design/theme.ts';
import { Icon, type IconName } from './Icon.tsx';
import { Logo } from './Logo.tsx';
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

export interface ThemeControl {
  theme: Theme;
  onCycle: () => void;
}

const THEME_ICONS: Record<Theme, IconName> = {
  system: 'monitor',
  light: 'sun',
  dark: 'moon',
};

export type TipFor = (text: string) => TipHandlers | undefined;

export const NO_TIP: TipFor = () => undefined;

export function Brand({ folded }: { folded: boolean }): ReactElement {
  return folded ? (
    <span className="fd-brand">
      <Logo />
      <span className="fd-visually-hidden">FactoryDeck</span>
    </span>
  ) : (
    <span className="fd-brand">
      <Logo />
      <span>
        Factory<span className="fd-brand-accent">Deck</span>
      </span>
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

function ThemeButton({
  theme,
  onCycle,
  folded,
  tipFor,
}: ThemeControl & { folded: boolean; tipFor: TipFor }): ReactElement {
  const name = `Theme: ${THEME_LABELS[theme]}`;
  return (
    <button
      type="button"
      className="fd-control fd-sidebar-icon-button fd-sidebar-theme"
      aria-label={name}
      onClick={onCycle}
      {...tipFor(name)}
    >
      <Icon name={THEME_ICONS[theme]} />
      {!folded && (
        <span className="fd-sidebar-label" aria-hidden="true">
          {THEME_LABELS[theme]}
        </span>
      )}
    </button>
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
  themeControl: ThemeControl;
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
  themeControl,
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
        <div className="fd-sidebar-actions">
          <ThemeButton {...themeControl} folded={folded} tipFor={tipFor} />
          {bottom}
        </div>
      </div>
    </aside>
  );
}
