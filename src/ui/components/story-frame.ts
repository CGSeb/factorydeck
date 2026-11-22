import type { Decorator } from '@storybook/react-vite';
import { createElement } from 'react';

export const surfaceFrame: Decorator = (Story) =>
  createElement(
    'div',
    {
      style: {
        background: 'var(--fd-surface)',
        color: 'var(--fd-ink)',
        fontFamily: 'var(--fd-font-body)',
        fontSize: 'var(--fd-text-md)',
        padding: 'var(--fd-space-4)',
      },
    },
    createElement(Story),
  );
