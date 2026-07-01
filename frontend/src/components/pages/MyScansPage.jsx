import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth0 } from '@auth0/auth0-react';
import { request } from '../../api/client.js';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
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
        <Table aria-label="Saved scans">
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Saved</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scans.map((scan) => (
              <TableRow key={scan.domain}>
                <TableCell>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onUseDomain?.(scan.domain)}>
                    {scan.domain}
                  </Button>
                </TableCell>
                <TableCell>{scan.saved_at}</TableCell>
                <TableCell>{scan.last_status}</TableCell>
                <TableCell>{scan.notes || ''}</TableCell>
                <TableCell>
                  <Button type="button" variant="secondary" size="sm" onClick={() => onRescan?.(scan.domain)}>
                    Scan again
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
