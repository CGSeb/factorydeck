import type { ReactElement } from 'react';
import { EmptyState, type EmptyStateStep } from './components/EmptyState.tsx';
import './shell.css';

const STEPS: readonly EmptyStateStep[] = [
  {
    key: 'install',
    content: (
      <>
        Install factorydeck-skills in your coding agent: see the{' '}
        <a href="https://github.com/CGSeb/factorydeck-skills#install">
          install steps
        </a>
        .
      </>
    ),
  },
  {
    key: 'setup',
    content: (
      <>
        In your project, run <code>/setup-factory</code>. It writes{' '}
        <code>docs/agents/factory.yml</code>.
      </>
    ),
  },
  {
    key: 'work',
    content: (
      <>
        Work in that project with your coding agent. FactoryDeck finds it at its
        next ingestion, earlier sessions included.
      </>
    ),
  },
];

export function WelcomePanel(): ReactElement {
  return (
    <EmptyState
      eyebrow="No factory project yet"
      title="Install the factory in a project"
      text="FactoryDeck shows the projects that use the factorydeck-skills workflow. None of yours does yet."
      steps={STEPS}
      footnote="The project select appears once a project has sessions."
    />
  );
}
