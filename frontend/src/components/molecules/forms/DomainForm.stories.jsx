import { expect, fn, userEvent, within } from 'storybook/test';

import DomainForm from './DomainForm.jsx';

export default {
  component: DomainForm,
  tags: ['autodocs', 'ai-generated', 'needs-work'],
};

export const Uncontrolled = {
  args: {
    initialDomain: 'https://www.example.com',
    onSubmit: fn(),
  },
};

export const Controlled = {
  args: {
    domain: 'example.org',
    onDomainChange: fn(),
    onSubmit: fn(),
  },
};

export const SubmitNormalizesDomain = {
  args: {
    initialDomain: 'https://www.example.com',
    onSubmit: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('WordPress domain');

    await userEvent.clear(input);
    await userEvent.type(input, 'https://WWW.Example.com/');
    await userEvent.click(canvas.getByRole('button', { name: /start scan/i }));

    await expect(args.onSubmit).toHaveBeenCalledWith('example.com');
  },
};
