import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '../templates/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchInvestigations } from '../../api/client.js';
import { loadAnonymousInvestigation } from '../../services/anonymousInvestigations.js';
import { formatDate } from '../../utils/format.js';

type InvestigationSummary = {
  id: string;
  domain: { normalized: string };
  updatedAt: string;
  latestSessionId?: string;
  selectedCapabilityCount: number;
  completedCapabilityCount: number;
  findingsCount: number;
};

type LocalSnapshot = {
  domain: { normalized: string };
  record: {
    session: {
      completedAt: string | null;
      selectedCapabilities: unknown[];
      capabilityStates: Record<string, { status: string; outcome?: { result?: unknown } }>;
    };
  };
};

type InvestigationRow = InvestigationSummary & { local?: boolean; resumable: boolean };

type InvestigationsPageProps = {
  headerActions?: ReactNode;
  onNavigate?: (page: string) => void;
  isAuthenticated: boolean;
  onResumeLocal?: () => void;
  onResumeInvestigation?: (investigationId: string) => void;
};

function InvestigationsPage({
  headerActions,
  onNavigate,
  isAuthenticated,
  onResumeLocal,
  onResumeInvestigation,
}: InvestigationsPageProps) {
  const [localSnapshot] = useState(() => loadAnonymousInvestigation() as LocalSnapshot | null);
  const investigationsQuery = useQuery({
    queryKey: ['investigations'],
    queryFn: () => fetchInvestigations() as unknown as Promise<{ investigations: InvestigationSummary[] }>,
    enabled: isAuthenticated,
    retry: false,
  });
  const localRow = localSnapshot ? toLocalRow(localSnapshot) : null;
  const remoteRows: InvestigationRow[] = (investigationsQuery.data?.investigations ?? []).map((summary) => ({
    ...summary,
    resumable: Boolean(summary.latestSessionId),
  }));
  const rows = localRow ? [localRow, ...remoteRows] : remoteRows;

  return (
    <AppLayout title="Investigations" subtitle={undefined} sidebar={undefined} headerActions={headerActions} onNavigate={onNavigate}>
      <Card className="" role="region" aria-label="Investigations">
        <CardHeader className=""><CardTitle className="">Investigations</CardTitle></CardHeader>
        <CardContent className="">
          {isAuthenticated && investigationsQuery.isLoading ? <p role="status">Loading investigations</p> : null}
          {isAuthenticated && investigationsQuery.isError ? (
            <div role="alert">
              <p>Could not load investigations</p>
              <Button className="" type="button" variant="secondary" size="sm" onClick={() => investigationsQuery.refetch()}>Retry</Button>
            </div>
          ) : null}
          {!investigationsQuery.isLoading && !investigationsQuery.isError && rows.length === 0 ? (
            <p>{isAuthenticated
              ? 'No investigations yet. Start an investigation to see it here.'
              : 'No investigations yet. Start an investigation in the scanner.'}</p>
          ) : null}
          {rows.length > 0 ? (
            <Table className="" aria-label="Investigations">
              <TableHeader className="">
                <TableRow className="">
                  <TableHead className="">Domain</TableHead>
                  <TableHead className="">Findings</TableHead>
                  <TableHead className="">Capabilities</TableHead>
                  <TableHead className="">Last activity</TableHead>
                  <TableHead className="">Actions</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody className="">
                {rows.map((row) => (
                  <TableRow className="" key={row.local ? 'local' : row.id}>
                    <TableCell className="">
                      <div>{row.domain.normalized.replace(/^https?:\/\//, '')}</div>
                      {row.local ? <small>Local</small> : null}
                    </TableCell>
                    <TableCell className="">{row.findingsCount}</TableCell>
                    <TableCell className="">{row.completedCapabilityCount} / {row.selectedCapabilityCount}</TableCell>
                    <TableCell className="">{formatDate(row.updatedAt)}</TableCell>
                    <TableCell className="">
                      {row.resumable ? (
                          <Button
                          className=""
                          type="button"
                          variant="secondary"
                          size="sm"
                          aria-label={`Resume ${row.domain.normalized.replace(/^https?:\/\//, '')}`}
                          onClick={() => row.local
                            ? onResumeLocal?.()
                            : onResumeInvestigation?.(row.id)}
                        >
                          Resume
                        </Button>
                      ) : <span>No resumable session</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function toLocalRow(snapshot: LocalSnapshot): InvestigationRow {
  const session = snapshot.record.session;
  const successfulStates = Object.values(session.capabilityStates).filter((state) => state.status === 'success');
  const findingsCount = successfulStates.reduce((count, state) => {
    const result = state.outcome?.result;
    return count + (typeof result === 'object' && result !== null && 'findings' in result
      && Array.isArray(result.findings) ? result.findings.length : 0);
  }, 0);

  return {
    id: 'local-investigation',
    domain: snapshot.domain,
    updatedAt: session.completedAt ?? new Date().toISOString(),
    selectedCapabilityCount: session.selectedCapabilities.length,
    completedCapabilityCount: successfulStates.length,
    findingsCount,
    local: true,
    resumable: true,
  };
}

export default InvestigationsPage;
