import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Button from './Button.jsx';
import TextInput from './TextInput.jsx';

describe('atomic adapters', () => {
  it('exposes shadcn slots while preserving live atom APIs', () => {
    render(
      <>
        <Button variant="primary">Save</Button>
        <TextInput aria-label="Query" />
      </>
    );

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('data-slot', 'button');
    expect(screen.getByLabelText('Query')).toHaveAttribute('data-slot', 'input');
  });
});
