/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck Legacy shared UI components expose incomplete prop declarations.

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import toast from 'react-hot-toast';
import { request } from '../../api/client.js';
import { clearUserSavedScans } from '../../api/client.js';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import AppLayout from '../templates/AppLayout';

type SavedScan = {
  domain: string;
  saved_at?: string;
  last_status?: string;
  notes?: string | null;
};

type MyScansPageProps = {
  headerActions?: ReactNode;
  onNavigate?: (page: string) => void;
  onUseDomain?: (domain: string) => void;
  onRescan?: (domain: string) => void;
};

function MyScansPage({ headerActions, onNavigate, onUseDomain, onRescan }: MyScansPageProps) {
  const { isAuthenticated, isLoading } = useAuth0();
  const [scans, setScans] = useState<SavedScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

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
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isAuthenticated]);

  async function handleClearSavedScans() {
    try {
      setIsClearing(true);
      await clearUserSavedScans();
      setScans([]);
      toast.success('Cleared saved scans');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear saved scans');
    } finally {
      setIsClearing(false);
      setIsClearDialogOpen(false);
    }
  }

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

      <Card role="region" aria-label="Saved scans">
        <CardHeader>
          <div>
            <CardTitle>Saved scans</CardTitle>
            <CardDescription>Domains you saved from previous scans.</CardDescription>
          </div>
          <CardAction>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsClearDialogOpen(true)}
              disabled={loading || scans.length === 0 || isClearing}
            >
              Clear saved scans
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear saved scans?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes only the scans you saved in My Scans. Recent scan history stays intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearSavedScans}>Clear saved scans</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

export default MyScansPage;
