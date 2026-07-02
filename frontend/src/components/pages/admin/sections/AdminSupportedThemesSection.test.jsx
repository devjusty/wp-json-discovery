import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminSupportedThemesSection from './AdminSupportedThemesSection.jsx';

describe('AdminSupportedThemesSection', () => {
  it('renders the error state inside a shadcn card', () => {
    render(
      <AdminSupportedThemesSection
        themeCatalogQuery=""
        setThemeCatalogQuery={() => {}}
        themeCatalogSort="labelAsc"
        setThemeCatalogSort={() => {}}
        isError
        errorMessage="Unable to load supported themes."
      />
    );

    const errorCard = screen.getByText('Unable to load supported themes.').closest('.card--error');
    expect(errorCard).toHaveAttribute('data-slot', 'card');
  });

  it('renders the sort control as a shadcn select trigger', () => {
    render(
      <AdminSupportedThemesSection
        themeCatalogQuery=""
        setThemeCatalogQuery={vi.fn()}
        themeCatalogSort="labelAsc"
        setThemeCatalogSort={vi.fn()}
        filteredSupportedThemes={[]}
        setExpandedThemeId={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox', { name: 'Sort' }).closest('[data-slot="select-trigger"]')).toBeInTheDocument();
  });
});
