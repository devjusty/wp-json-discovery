import { initialize, mswLoader } from 'msw-storybook-addon';

import '../src/index.css';
import '../src/App.css';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono';

initialize({ onUnhandledRequest: 'bypass' });

/** @type { import('@storybook/react-vite').Preview } */
const preview = {
  decorators: [
    (Story) => {
      const StoryComponent = Story;

      return (
        <div className="min-h-screen bg-background text-foreground font-sans">
          <StoryComponent />
        </div>
      );
    },
  ],
  loaders: [mswLoader],
  parameters: {
    layout: 'padded',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      test: 'todo',
    }
  },
};

export default preview;
