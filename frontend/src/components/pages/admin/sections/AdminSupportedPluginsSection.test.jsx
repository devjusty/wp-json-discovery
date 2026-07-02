import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminSupportedPluginsSection from './AdminSupportedPluginsSection.jsx';

describe('AdminSupportedPluginsSection', () => {
  it('renders the error state inside a shadcn card', () => {
    render(
      <AdminSupportedPluginsSection
        pluginCatalogQuery=""
        setPluginCatalogQuery={vi.fn()}
        pluginCatalogSort="labelAsc"
        setPluginCatalogSort={vi.fn()}
        filteredSupportedPlugins={[]}
        setExpandedPluginId={vi.fn()}
        isError
        errorMessage="Unable to load supported plugins."
      />
    );

    expect(screen.getByText('Unable to load supported plugins.').closest('.card--error')).toHaveAttribute('data-slot', 'card');
  });
});
