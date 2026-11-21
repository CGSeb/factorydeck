// @vitest-environment happy-dom
/// <reference types="vite/client" />
import { readdirSync } from 'node:fs';
import { type ReactRenderer, composeStories } from '@storybook/react';
import { act, cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import type { ComposedStoryFn } from 'storybook/internal/types';
import { afterEach, describe, expect, it } from 'vitest';

/** Files of `src/ui` that are not components: entry points mount the app, they have no story. */
const WITHOUT_STORY = new Set(['main']);

type StoryModule = Parameters<typeof composeStories>[0];
type ComposedStory = ComposedStoryFn<ReactRenderer>;

const modules = import.meta.glob<StoryModule>('./**/*.stories.tsx', {
  eager: true,
});

const stories = Object.entries(modules).flatMap(([file, module]) =>
  Object.entries<ComposedStory>(composeStories(module)).map(
    ([name, Story]): [string, ComposedStory] => [`${file} ${name}`, Story],
  ),
);

function componentsWithoutStory(): string[] {
  const files = readdirSync(import.meta.dirname, { recursive: true }).map(
    String,
  );
  return files
    .filter((file) => /^[^.]+\.tsx$/.test(file.split('/').at(-1) ?? ''))
    .map((file) => file.replace(/\.tsx$/, ''))
    .filter(
      (name) =>
        !WITHOUT_STORY.has(name) && !files.includes(`${name}.stories.tsx`),
    );
}

describe('component library', () => {
  afterEach(cleanup);

  it('has a story for every component', () => {
    expect(componentsWithoutStory()).toEqual([]);
  });

  it.each(stories)(
    '%s renders, plays and has no accessibility issue',
    async (_, Story) => {
      const { container } = await act(() => render(<Story />));
      await Story.play?.({ canvasElement: container });
      expect(container.textContent).not.toBe('');
      // happy-dom computes no colours, so contrast is checked by eye in Storybook, not here.
      const { violations } = await axe.run(container, {
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(violations.map(({ id }) => id)).toEqual([]);
    },
  );
});
