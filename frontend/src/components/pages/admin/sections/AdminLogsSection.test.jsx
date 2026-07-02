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
});
