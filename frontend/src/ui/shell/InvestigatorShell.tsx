import { useState, type ReactNode } from 'react';
import type { Investigation } from '../../domain/investigation/model';
import type { InvestigatorCapabilityStatus, InvestigatorStatus } from '../../adapters/investigatorReadModel';
import { AppShell, type ShellNavigation } from './AppShell';
import { InvestigatorSectionSelector, type InvestigatorSection } from '../investigation/InvestigatorSectionSelector';
import { InvestigatorOverview } from '../investigation/InvestigatorOverview';
import { InvestigatorFindings } from '../investigation/InvestigatorFindings';
import { EvidenceDisclosure } from '../investigation/EvidenceDisclosure';
import { InvestigatorAssetsPanel, InvestigatorHistoryPanel, InvestigatorToolsPanel } from '../investigation/InvestigatorSectionPanels';

type InvestigatorShellReadModel = Readonly<{
  title: string;
  status?: InvestigatorStatus;
  blocked?: Readonly<{ reason?: string; guidance?: string; command?: string }>;
  sections: ReadonlyArray<InvestigatorSection>;
  capabilities: ReadonlyArray<Readonly<{
    name: string;
    status: InvestigatorCapabilityStatus;
    retryable?: boolean;
  }>>;
  investigation?: Investigation;
}>;

type InvestigatorShellProps = Readonly<{
  readModel: InvestigatorShellReadModel;
  commands: Readonly<{ onSectionChange: (sectionId: string) => void; onRetry?: (capabilityName: string) => void }>;
  activeSection?: string;
  contentLandmark?: 'main' | 'div';
  contentMode?: 'report' | 'legacy';
  headerActions?: ReactNode;
  children?: ReactNode;
}>;

export function InvestigatorShell({ readModel, commands, activeSection = readModel.sections[0]?.id ?? '', contentLandmark, contentMode = 'report', headerActions, children }: InvestigatorShellProps) {
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<ReadonlyArray<string> | null>(null);
  // Section nav lives in InvestigatorSectionSelector only — keep AppShell header for brand + actions.
  const navigation: ShellNavigation = { items: [], activeId: activeSection };
  const isPartial = readModel.status === 'partial' || readModel.status === 'failed';
  const isBlocked = readModel.status === 'blocked';
  const successfulCapabilityExists = readModel.capabilities.some(({ status }) => status === 'success');
  const retryableCapabilities = readModel.capabilities.filter(({ status, retryable }) => status === 'failed' && retryable);
  const activeSectionDefinition = readModel.sections.find(({ id }) => id === activeSection) ?? readModel.sections[0];
  const activeSectionLabel = activeSectionDefinition?.label ?? 'Investigation';
  const activeSectionHeadingId = `investigator-section-${activeSectionDefinition?.id ?? 'content'}`;

  const handleSectionChange = (sectionId: string) => {
    setSelectedEvidenceIds(null);
    commands.onSectionChange(sectionId);
  };
  const handleSelectEvidence = (evidenceIds: ReadonlyArray<string>) => {
    setSelectedEvidenceIds(evidenceIds);
    commands.onSectionChange('evidence');
  };

  return (
    <AppShell navigation={navigation} commands={{ onNavigate: handleSectionChange }} title={readModel.title} navigationLabel="Investigator navigation" contentLandmark={contentLandmark} headerActions={headerActions}>
      <div className="investigator-shell__section-selector"><InvestigatorSectionSelector sections={readModel.sections} activeSection={activeSection} onChange={handleSectionChange} /></div>
      {isPartial || isBlocked ? <div className={isBlocked ? 'investigator-blocked' : 'investigator-partial'} role={isBlocked ? 'alert' : 'status'}>
        <strong>{isBlocked ? 'Investigation blocked' : readModel.status === 'failed' ? 'Investigation failed' : 'Partial investigation'}</strong>
        {successfulCapabilityExists ? <span>Successful evidence remains available.</span> : null}
        {isBlocked && readModel.blocked?.reason ? <span>Reason: {readModel.blocked.reason}</span> : null}
        {isBlocked && readModel.blocked?.guidance ? <span>{readModel.blocked.guidance}</span> : null}
        {isBlocked && readModel.blocked?.command ? <span>Recovery command: <code>{readModel.blocked.command}</code></span> : null}
        {commands.onRetry ? retryableCapabilities.map((capability) => (
          <button type="button" key={capability.name} onClick={() => commands.onRetry?.(capability.name)}>
            Retry {capability.name}
          </button>
        )) : null}
      </div> : null}
      {contentMode === 'legacy' ? null : readModel.investigation ? (
        <InvestigatorSectionContent investigation={readModel.investigation} capabilities={readModel.capabilities} sectionId={activeSection} selectedEvidenceIds={selectedEvidenceIds} onInspect={handleSectionChange} onSelectEvidence={handleSelectEvidence} onRetry={commands.onRetry} />
      ) : (
        <section className="investigator-section-placeholder" aria-labelledby={activeSectionHeadingId} data-active="true">
          <p className="investigation-shell__eyebrow">Active investigation section</p>
          <h2 id={activeSectionHeadingId}>{activeSectionLabel}</h2>
          <p>{activeSectionDefinition?.description ?? `${activeSectionLabel} content is available in this investigation.`}</p>
        </section>
      )}
      <div className="investigator-shell__page-content">{children}</div>
    </AppShell>
  );
}

function InvestigatorSectionContent({ investigation, capabilities, sectionId, onInspect, onSelectEvidence, selectedEvidenceIds, onRetry }: Readonly<{
  investigation: Investigation;
  capabilities: InvestigatorShellReadModel['capabilities'];
  sectionId: string;
  onInspect: (sectionId: string) => void;
  onSelectEvidence: (evidenceIds: ReadonlyArray<string>) => void;
  selectedEvidenceIds: ReadonlyArray<string> | null;
  onRetry?: (capabilityName: string) => void;
}>) {
  if (sectionId === 'overview') return <InvestigatorOverview investigation={investigation} onInspect={onInspect} />;
  if (sectionId === 'findings') return <InvestigatorFindings investigation={investigation} onSelectEvidence={onSelectEvidence} />;
  if (sectionId === 'evidence') {
    const evidence = selectedEvidenceIds ? investigation.evidence.filter(({ id }) => selectedEvidenceIds.includes(id)) : investigation.evidence;
    return <EvidenceDisclosure evidence={evidence} rawBody={evidence.find(({ source }) => source.rawBody)?.source.rawBody} />;
  }
  if (sectionId === 'assets') return <InvestigatorAssetsPanel investigation={investigation} />;
  if (sectionId === 'history') return <InvestigatorHistoryPanel investigation={investigation} />;
  if (sectionId === 'tools') return <InvestigatorToolsPanel capabilities={capabilities} onRetry={onRetry} />;

  return (
    <section className="investigator-section-placeholder" aria-labelledby={`investigator-section-${sectionId}`} data-active="true">
      <p className="investigation-shell__eyebrow">Active investigation section</p>
      <h2 id={`investigator-section-${sectionId}`}>{sectionId[0]?.toUpperCase() + sectionId.slice(1)}</h2>
      <p>Use this section to inspect {sectionId} connected to {investigation.normalizedUrl}.</p>
    </section>
  );
}
