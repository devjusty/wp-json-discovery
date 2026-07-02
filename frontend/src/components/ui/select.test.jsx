import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './select.jsx';

describe('Select', () => {
  it('defaults the trigger to a full-width field layout', () => {
    render(
      <Select defaultValue="recent">
        <SelectTrigger aria-label="Sort by">
          <SelectValue>Most recent</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">Most recent</SelectItem>
        </SelectContent>
      </Select>
    );

    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveClass('w-full');
  });
});
