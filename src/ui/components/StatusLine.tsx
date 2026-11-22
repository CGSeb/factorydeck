import type { ReactElement, ReactNode } from 'react';
import './layout.css';

export function StatusLine({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return <p className="fd-status-line">{children}</p>;
}
