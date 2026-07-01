import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Button from './Button.jsx';
import { Card, CardActions, CardContent, CardHeader } from './Card.jsx';
import TextInput from './TextInput.jsx';

describe('atomic adapters', () => {
  it('exposes shadcn slots while preserving the old atom API', () => {
    render(
      <>
        <Button variant="primary">Save</Button>
        <Card as="article">
          <CardHeader>Title</CardHeader>
          <CardContent>Body</CardContent>
          <CardActions>Actions</CardActions>
        </Card>
        <TextInput aria-label="Query" />
      </>
    );

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('data-slot', 'button');

    const article = screen.getByRole('article');
    expect(article).toHaveAttribute('data-slot', 'card');
    expect(within(article).getByText('Title').closest('[data-slot="card-header"]')).not.toBeNull();
    expect(within(article).getByText('Body').closest('[data-slot="card-content"]')).not.toBeNull();
    expect(within(article).getByText('Actions').closest('[data-slot="card-footer"]')).not.toBeNull();

    expect(screen.getByLabelText('Query')).toHaveAttribute('data-slot', 'input');
  });
});
