import type { ReactElement, ReactNode } from 'react';
import './layout.css';

export function Aside({ children }: { children: ReactNode }): ReactElement {
  return <div className="fd-aside">{children}</div>;
}
