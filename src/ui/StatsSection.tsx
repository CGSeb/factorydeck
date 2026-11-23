import { type ReactElement, useId } from 'react';

export function StatsSection({
  title,
  children,
}: {
  title: string;
  children: ReactElement;
}): ReactElement {
  const id = useId();
  return (
    <section className="fd-stats-section" aria-labelledby={id}>
      <h3 id={id} className="fd-stats-section-title">
        {title}
      </h3>
      {children}
    </section>
  );
}
