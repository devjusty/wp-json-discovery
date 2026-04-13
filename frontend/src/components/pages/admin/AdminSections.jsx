import PropTypes from 'prop-types';
import AdminSectionContent from './AdminSectionContent.jsx';
import { SnapshotStatusCard } from './AdminSectionPrimitives.jsx';

// Thin wrapper for shared loading/error cards and active section content.

function AdminSections({ state }) {
  const {
    activeSection,
    snapshotQuery,
    domainsHistoryQuery,
    isSnapshotBackedSection
  } = state;

  return (
    <>
      {activeSection === 'db' && snapshotQuery.isLoading ? <SnapshotStatusCard label="Loading database snapshot..." /> : null}
      {activeSection === 'db' && snapshotQuery.isError ? (
        <SnapshotStatusCard
          tone="error"
          label={snapshotQuery.error?.message ?? 'Failed to load snapshot.'}
        />
      ) : null}

      {isSnapshotBackedSection && snapshotQuery.isLoading ? <SnapshotStatusCard label="Loading database snapshot..." /> : null}
      {isSnapshotBackedSection && snapshotQuery.isError ? (
        <SnapshotStatusCard
          tone="error"
          label={snapshotQuery.error?.message ?? 'Failed to load snapshot.'}
        />
      ) : null}

      {activeSection === 'domains' && domainsHistoryQuery.isLoading ? <SnapshotStatusCard label="Loading tracked domains..." /> : null}
      {activeSection === 'domains' && domainsHistoryQuery.isError ? (
        <SnapshotStatusCard
          tone="error"
          label={domainsHistoryQuery.error?.message ?? 'Failed to load tracked domains.'}
        />
      ) : null}

      <AdminSectionContent state={state} />
    </>
  );
}

AdminSections.propTypes = {
  state: PropTypes.object.isRequired
};

export default AdminSections;
