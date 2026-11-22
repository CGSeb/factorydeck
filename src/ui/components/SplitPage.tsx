import type { ReactElement, ReactNode } from 'react';
import { Aside } from './Aside.tsx';
import './layout.css';

export interface SplitPageProps {
  children: ReactNode;
  aside: ReactNode;
}

export function SplitPage({ children, aside }: SplitPageProps): ReactElement {
  return (
    <div className="fd-split">
      <div className="fd-split-main">{children}</div>
      <Aside>{aside}</Aside>
    </div>
  );
}
