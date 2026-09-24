import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renders auth actions after workspace actions', () => {
    render(
      <AppShell
        navigation={{ items: [], activeId: '' }}
        commands={{ onNavigate: vi.fn() }}
        headerActions={<button type="button">New scan</button>}
        authActions={<button type="button">Log in</button>}
      >
        content
      </AppShell>,
    );

    const actions = screen.getByRole('group', { name: 'Header actions' });
    expect(within(actions).getAllByRole('button').map((button) => button.textContent)).toEqual(['New scan', 'Log in']);
  });

  it('renders auth actions without workspace actions', () => {
    render(
      <AppShell navigation={{ items: [], activeId: '' }} commands={{ onNavigate: vi.fn() }} authActions={<button type="button">Log in</button>}>
        content
      </AppShell>,
    );

    expect(screen.getByRole('group', { name: 'Header actions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('renders without a header action group when no actions exist', () => {
    render(<AppShell navigation={{ items: [], activeId: '' }} commands={{ onNavigate: vi.fn() }}>content</AppShell>);

    expect(screen.queryByRole('group', { name: 'Header actions' })).not.toBeInTheDocument();
  });
});
