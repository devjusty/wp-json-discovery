import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScanSettingsPanel from './ScanSettingsPanel.jsx';

const homepageSelection = {
  capabilityIds: ['homepage', 'wordpress'],
  options: {
    homepage: {},
    wordpress: {}
  }
};

describe('ScanSettingsPanel', () => {
  it('keeps required WordPress API selected and cannot deselect it', async () => {
    const user = userEvent.setup();
    const onScanSettingsChange = vi.fn();
    render(
      <ScanSettingsPanel
        scanSettings={homepageSelection}
        onScanSettingsChange={onScanSettingsChange}
      />
    );

    const wordpress = screen.getByRole('checkbox', { name: /WordPress API/ });
    expect(wordpress).toBeChecked();
    expect(wordpress).toHaveAttribute('aria-disabled', 'true');
    await user.click(wordpress);
    expect(onScanSettingsChange).not.toHaveBeenCalled();
  });

  it('updates optional homepage and sitemap selections', async () => {
    const user = userEvent.setup();
    const onScanSettingsChange = vi.fn();

    render(
      <ScanSettingsPanel
        scanSettings={homepageSelection}
        onScanSettingsChange={onScanSettingsChange}
      />
    );

    await user.click(screen.getByRole('checkbox', { name: /Homepage/ }));
    expect(onScanSettingsChange).toHaveBeenLastCalledWith({
      capabilityIds: ['wordpress'],
      options: { wordpress: {} }
    });

    await user.click(screen.getByRole('checkbox', { name: /Sitemap/ }));
    expect(onScanSettingsChange).toHaveBeenLastCalledWith({
      capabilityIds: ['homepage', 'sitemap', 'wordpress'],
      options: {
        homepage: {},
        sitemap: { sitemapUrl: '', maxPages: 50 },
        wordpress: {}
      }
    });
  });

  it('shows sitemap options only when sitemap is selected', () => {
    const { rerender } = render(<ScanSettingsPanel scanSettings={homepageSelection} />);

    expect(screen.queryByLabelText('Sitemap URL')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Max pages')).not.toBeInTheDocument();

    rerender(
      <ScanSettingsPanel
        scanSettings={{
          capabilityIds: ['sitemap', 'wordpress'],
          options: { sitemap: { sitemapUrl: '', maxPages: 50 }, wordpress: {} }
        }}
      />
    );

    expect(screen.getByLabelText('Sitemap URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Max pages')).toHaveAttribute('max', '50');
  });

  it('updates and clamps sitemap options without changing other capability options', () => {
    const onScanSettingsChange = vi.fn();
    const selection = {
      capabilityIds: ['homepage', 'sitemap', 'wordpress'],
      options: {
        homepage: {},
        sitemap: { sitemapUrl: '', maxPages: 50 },
        wordpress: {}
      }
    };
    const { rerender } = render(
      <ScanSettingsPanel
        scanSettings={selection}
        onScanSettingsChange={onScanSettingsChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Sitemap URL'), {
      target: { value: ' /news-sitemap.xml ' }
    });
    const withUrl = {
      capabilityIds: ['homepage', 'sitemap', 'wordpress'],
      options: {
        homepage: {},
        sitemap: { sitemapUrl: '/news-sitemap.xml', maxPages: 50 },
        wordpress: {}
      }
    };
    expect(onScanSettingsChange).toHaveBeenLastCalledWith(withUrl);

    rerender(<ScanSettingsPanel scanSettings={withUrl} onScanSettingsChange={onScanSettingsChange} />);
    fireEvent.change(screen.getByLabelText('Max pages'), { target: { value: '99' } });

    expect(onScanSettingsChange).toHaveBeenLastCalledWith({
      capabilityIds: ['homepage', 'sitemap', 'wordpress'],
      options: {
        homepage: {},
        sitemap: { sitemapUrl: '/news-sitemap.xml', maxPages: 50 },
        wordpress: {}
      }
    });
  });

  it('shows recommendation and value-cost copy', () => {
    render(<ScanSettingsPanel scanSettings={homepageSelection} />);

    expect(screen.getByText('Recommended: Homepage and WordPress API.')).toBeInTheDocument();
    expect(screen.getByText('Value 4 · Cost 3')).toBeInTheDocument();
  });

  it('saves the current normalized selection before scanning', async () => {
    const user = userEvent.setup();
    const onSaveDefaults = vi.fn();

    render(
      <ScanSettingsPanel
        scanSettings={{ capabilityIds: ['sitemap'], options: { sitemap: { maxPages: 10 } } }}
        onSaveDefaults={onSaveDefaults}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Save as default' }));

    expect(onSaveDefaults).toHaveBeenCalledWith({
      capabilityIds: ['sitemap', 'wordpress'],
      options: {
        sitemap: { sitemapUrl: '', maxPages: 10 },
        wordpress: {}
      }
    });
  });

  it('disables optional settings and default saving while scanning', () => {
    render(
      <ScanSettingsPanel
        scanSettings={homepageSelection}
        onScanSettingsChange={vi.fn()}
        onSaveDefaults={vi.fn()}
        isScanning
      />
    );

    expect(screen.getByRole('checkbox', { name: /Homepage/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Save as default' })).toBeDisabled();
  });
});
