import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth0 } from '@auth0/auth0-react';
import { request } from '../../api/client.js';
import { Button } from '@/components/ui/button';
import AppLayout from '../templates/AppLayout.jsx';

function MyScansPage({ headerActions, onNavigate, onUseDomain, onRescan }) {
  const { isAuthenticated, isLoading } = useAuth0();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const result = await request('/api/user/scans');
        if (result.ok) {
          setScans(result.data.domains || []);
        } else {
          setError('Failed to load scans');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isAuthenticated]);

  if (isLoading) {
    return <AppLayout title="My Scans" headerActions={headerActions} onNavigate={onNavigate}>Loading...</AppLayout>;
  }

  if (!isAuthenticated) {
    return (
      <AppLayout title="My Scans" headerActions={headerActions} onNavigate={onNavigate}>
        <p>Please log in to view your saved scans.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="My Scans" headerActions={headerActions} onNavigate={onNavigate}>
      {error ? <p className="text-error">{error}</p> : null}
      {loading ? <p>Loading...</p> : null}
      {!loading && scans.length === 0 ? (
        <p>No saved scans yet. Run a scan and click "Save to My Scans" to add one.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Saved</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((scan) => (
              <tr key={scan.domain}>
                <td>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onUseDomain?.(scan.domain)}>
                    {scan.domain}
                  </Button>
                </td>
                <td>{scan.saved_at}</td>
                <td>{scan.last_status}</td>
                <td>{scan.notes || ''}</td>
                <td>
                  <Button type="button" variant="secondary" size="sm" onClick={() => onRescan?.(scan.domain)}>
                    Scan again
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppLayout>
  );
}

MyScansPage.propTypes = {
  headerActions: PropTypes.node,
  onNavigate: PropTypes.func,
  onUseDomain: PropTypes.func,
  onRescan: PropTypes.func
};

MyScansPage.defaultProps = {
  headerActions: null,
  onNavigate: undefined,
  onUseDomain: undefined,
  onRescan: undefined
};

export default MyScansPage;
