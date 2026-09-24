import { useMemo, useState, type ReactNode } from 'react';
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
import { loadAnonymousInvestigation } from '../../services/anonymousInvestigations.js';
import { formatDate } from '../../utils/format.js';
import type { Investigation } from '../../domain/investigation/model';
import type { InvestigationStore } from '../../application/ports/investigation-store';
import type { AuthSession } from '../../application/ports/auth-session';
import { createLocalInvestigationStore } from '../../adapters/persistence/localInvestigationStore';
import { createRemoteInvestigationStore } from '../../adapters/persistence/remoteInvestigationStore';

type InvestigationSummary = {
  id: string;
  domain: { normalized: string };
  updatedAt: string;
  latestSessionId?: string;
  selectedCapabilityCount: number;
  completedCapabilityCount: number;
  findingsCount: number;
  status?: string;
  resumable?: boolean;
};

type LocalSnapshot = {
  domain: { normalized: string };
  record: {
    persistedAt: string;
    session: {
      completedAt: string | null;
      selectedCapabilities: unknown[];
      capabilityStates: Record<string, { status: string; outcome?: { result?: unknown; error?: { retryable?: boolean } } }>;
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
  embedded?: boolean;
  investigationStore?: InvestigationStore;
  authSession?: AuthSession;
};

function InvestigationsPage({
  headerActions,
  onNavigate,
  isAuthenticated,
  onResumeLocal,
  onResumeInvestigation,
  embedded = false,
  investigationStore,
  authSession,
}: InvestigationsPageProps) {
  const [localSnapshot] = useState(() => loadAnonymousInvestigation() as LocalSnapshot | null);
  const stores = useMemo(() => {
    if (investigationStore) return { active: investigationStore, local: investigationStore };
    if (isAuthenticated && !authSession) return { active: createLocalInvestigationStore(), local: createLocalInvestigationStore() };
    return {
      active: isAuthenticated
        ? createRemoteInvestigationStore({ authSession })
        : createLocalInvestigationStore(),
      local: createLocalInvestigationStore(),
    };
  }, [authSession, investigationStore, isAuthenticated]);
  const investigationsQuery = useQuery({
    queryKey: ['investigations'],
    queryFn: async () => {
      try {
        return await stores.active.list();
      } catch {
        throw new Error('Investigation store unavailable.');
      }
    },
    enabled: true,
    retry: false,
  });
  const localRow = localSnapshot ? toLocalRow(localSnapshot) : null;
  const remoteRows: InvestigationRow[] = (investigationsQuery.data ?? []).map((summary) => toRow(summary));
  const storeRows = !isAuthenticated ? remoteRows.map((row) => ({ ...row, local: true })) : remoteRows;
  const rows = isAuthenticated
    ? (localRow ? [localRow, ...storeRows] : storeRows)
    : (storeRows.length > 0 ? storeRows : localRow ? [localRow] : []);

  return (
    <AppLayout title="Investigations" subtitle={undefined} sidebar={undefined} headerActions={headerActions} onNavigate={onNavigate} embedded={embedded}>
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
                  <TableHead className="">Status</TableHead>
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
                    <TableCell className="">{row.status ?? 'unknown'}</TableCell>
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
    updatedAt: snapshot.record.persistedAt,
    selectedCapabilityCount: session.selectedCapabilities.length,
    completedCapabilityCount: successfulStates.length,
    findingsCount,
    status: deriveStatus(Object.values(session.capabilityStates).map(({ status }) => status)),
    local: true,
    resumable: Object.values(session.capabilityStates).some(({ status, outcome }) => (
      ['queued', 'running'].includes(status)
      || (status === 'failed' && outcome?.error?.retryable === true)
    )),
  };
}

function toRow(value: Investigation | InvestigationSummary): InvestigationRow {
  if ('submittedUrl' in value) {
    const completed = value.capabilities.filter(({ status }) => status === 'success').length;
    const hasActive = value.capabilities.some(({ status }) => status === 'queued' || status === 'running');
    return {
      id: value.id,
      domain: { normalized: value.normalizedUrl },
      updatedAt: value.updatedAt ?? value.createdAt,
      selectedCapabilityCount: value.capabilities.length,
      completedCapabilityCount: completed,
      findingsCount: value.findings.length,
      status: deriveStatus(value.capabilities.map(({ status }) => status)),
      resumable: hasActive || value.capabilities.some(({ status, error }) => status === 'failed' && error?.retryable),
    };
  }
  return {
    ...value,
    resumable: value.resumable ?? Boolean(value.latestSessionId),
  };
}

function deriveStatus(statuses: string[]): string {
  if (statuses.length === 0 || statuses.some((status) => ['queued', 'running'].includes(status))) return 'incomplete';
  const successes = statuses.filter((status) => status === 'success').length;
  if (successes === statuses.length) return 'complete';
  if (successes > 0) return 'partial';
  return 'failed';
}

export default InvestigationsPage;
