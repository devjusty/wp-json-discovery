import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});
