import type { Preview } from '@storybook/nextjs-vite';

import '../src/app/globals.css';
import { ThemeProvider } from '../src/components/theme-provider';

const preview: Preview = {
  decorators: [
    Story => (
      <ThemeProvider forcedTheme='dark'>
        <Story />
      </ThemeProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
