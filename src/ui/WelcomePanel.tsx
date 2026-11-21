import { type ReactElement, useId } from 'react';

export function WelcomePanel(): ReactElement {
  const titleId = useId();
  return (
    <section className="panel welcome" aria-labelledby={titleId}>
      <h1 id={titleId}>Install the factory in a project</h1>
      <p>
        FactoryDeck shows the projects that use the factorydeck-skills workflow.
        None of yours does yet.
      </p>
      <ol>
        <li>
          Install the plugin in Claude Code:{' '}
          <code>/plugin marketplace add CGSeb/factorydeck-skills</code>, then{' '}
          <code>/plugin install factorydeck-skills@factorydeck</code>.
        </li>
        <li>
          In your project, run <code>/setup-factory</code>. It writes{' '}
          <code>docs/agents/factory.yml</code>.
        </li>
        <li>
          Work in that project with Claude Code. FactoryDeck finds it at its
          next ingestion, earlier sessions included.
        </li>
      </ol>
    </section>
  );
}
