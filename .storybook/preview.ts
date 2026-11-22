import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '../src/ui/design/tokens.css';
import '../src/ui/design/theme-dark.css';
import type { Preview } from '@storybook/react-vite';
import {
  THEMES,
  type Theme,
  applyTheme,
  writeTheme,
} from '../src/ui/design/theme.ts';

function isTheme(value: unknown): value is Theme {
  return THEMES.some((theme) => theme === value);
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Colour theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'system', title: 'System' },
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'system' },
  decorators: [
    (Story, { globals }) => {
      const theme: unknown = globals['theme'];
      if (isTheme(theme)) {
        writeTheme(theme);
        applyTheme(theme);
      }
      return Story();
    },
  ],
};

export default preview;
