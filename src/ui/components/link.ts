import { type ReactElement, type ReactNode, createElement } from 'react';

export interface LinkProps {
  href: string;
  className?: string;
  'aria-current'?: 'page';
  'aria-label'?: string;
  onClick?: () => void;
  children: ReactNode;
}

export type RenderLink = (props: LinkProps) => ReactElement;

export const renderAnchor: RenderLink = (props) => createElement('a', props);
