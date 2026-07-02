import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AdminLogsSection from './AdminLogsSection.jsx';

describe('AdminLogsSection', () => {
  it('renders the header actions in a shadcn card action slot', () => {
    render(
      <AdminLogsSection
        activityLogs={[]}
        logTypeFilter="all"
        setLogTypeFilter={() => {}}
        logTypes={[]}
        filteredActivityLogs={[]}
        expandedLogIds={new Set()}
        setExpandedLogIds={() => {}}
        rotateLogs={() => {}}
        isRotatingLogs={false}
        pruneMutation={{ mutate: () => {}, isPending: false }}
      />
    );

    expect(screen.getByText('Rotate activity log').closest('[data-slot="card-action"]')).toBeInTheDocument();
  });

  it('renders the log type filter as a shadcn select trigger', () => {
    render(
      <AdminLogsSection
        activityLogs={[{ id: 'log-1', timestamp: '2026-07-02T12:00:00.000Z', payload: {} }]}
        logTypeFilter="all"
        setLogTypeFilter={() => {}}
        logTypes={['scan']}
        filteredActivityLogs={[]}
        expandedLogIds={new Set()}
        setExpandedLogIds={() => {}}
        rotateLogs={() => {}}
        isRotatingLogs={false}
        pruneMutation={{ mutate: () => {}, isPending: false }}
      />
    );

    expect(screen.getByRole('combobox', { name: 'Type' }).closest('[data-slot="select-trigger"]')).toBeInTheDocument();
  });
});
