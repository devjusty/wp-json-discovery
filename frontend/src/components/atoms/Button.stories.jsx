import { expect } from 'storybook/test';

import Button from './Button.jsx';

export default {
  component: Button,
  tags: ['autodocs', 'ai-generated', 'needs-work'],
};

export const Primary = {
  args: {
    children: 'Start scan',
    variant: 'primary',
    size: 'md',
  },
};

export const Secondary = {
  args: {
    children: 'Refresh',
    variant: 'secondary',
    size: 'md',
  },
};

export const Ghost = {
  args: {
    children: 'Dismiss',
    variant: 'ghost',
    size: 'md',
  },
};

export const CssCheck = {
  args: {
    children: 'Primary token check',
    variant: 'primary',
    size: 'md',
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector('button');

    await expect(button).toHaveStyle({ backgroundColor: 'rgb(96, 165, 250)' });
  },
};
