import type { ReactNode } from 'react';
import type { CapabilityStatus, Investigation } from '../../domain/investigation/model';
import { AppShell, type ShellNavigation } from './AppShell';
import { InvestigatorSectionSelector, type InvestigatorSection } from '../investigation/InvestigatorSectionSelector';
import { InvestigatorOverview } from '../investigation/InvestigatorOverview';
import { InvestigatorFindings } from '../investigation/InvestigatorFindings';
import { EvidenceDisclosure } from '../investigation/EvidenceDisclosure';

type InvestigatorShellReadModel = Readonly<{
  title: string;
  status: 'complete' | 'partial' | 'failed' | 'blocked' | 'incomplete';
  sections: ReadonlyArray<InvestigatorSection>;
  capabilities: ReadonlyArray<Readonly<{
    name: string;
    status: CapabilityStatus;
    retryable?: boolean;
  }>>;
  investigation?: Investigation;
}>;

type InvestigatorShellProps = Readonly<{
  readModel: InvestigatorShellReadModel;
  commands: Readonly<{ onSectionChange: (sectionId: string) => void; onRetry?: (capabilityName: string) => void }>;
  activeSection?: string;
  contentLandmark?: 'main' | 'div';
  children: ReactNode;
}>;

export function InvestigatorShell({ readModel, commands, activeSection = readModel.sections[0]?.id ?? '', contentLandmark, children }: InvestigatorShellProps) {
  const navigation: ShellNavigation = { items: readModel.sections, activeId: activeSection };
  const isPartial = readModel.status === 'partial' || readModel.status === 'failed';
  const successfulCapabilityExists = readModel.capabilities.some(({ status }) => status === 'success');
  const retryableCapabilities = readModel.capabilities.filter(({ status, retryable }) => status === 'failed' && retryable);
  const activeSectionDefinition = readModel.sections.find(({ id }) => id === activeSection) ?? readModel.sections[0];
  const activeSectionLabel = activeSectionDefinition?.label ?? 'Investigation';
  const activeSectionHeadingId = `investigator-section-${activeSectionDefinition?.id ?? 'content'}`;

  return (
    <AppShell navigation={navigation} commands={{ onNavigate: commands.onSectionChange }} title={readModel.title} navigationLabel="Investigator navigation" contentLandmark={contentLandmark}>
      <div className="investigator-shell__section-selector"><InvestigatorSectionSelector sections={readModel.sections} activeSection={activeSection} onChange={commands.onSectionChange} /></div>
      {isPartial ? <div className="investigator-partial" role="status">
        <strong>{readModel.status === 'failed' ? 'Investigation failed' : 'Partial investigation'}</strong>
        {successfulCapabilityExists ? <span>Successful evidence remains available.</span> : null}
        {commands.onRetry ? retryableCapabilities.map((capability) => (
          <button type="button" key={capability.name} onClick={() => commands.onRetry?.(capability.name)}>
            Retry {capability.name}
          </button>
        )) : null}
      </div> : null}
      {readModel.investigation ? (
        <InvestigatorSectionContent investigation={readModel.investigation} sectionId={activeSection} onInspect={commands.onSectionChange} />
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

function InvestigatorSectionContent({ investigation, sectionId, onInspect }: Readonly<{
  investigation: Investigation;
  sectionId: string;
  onInspect: (sectionId: string) => void;
}>) {
  if (sectionId === 'overview') return <InvestigatorOverview investigation={investigation} onInspect={onInspect} />;
  if (sectionId === 'findings') return <InvestigatorFindings investigation={investigation} onSelectEvidence={() => onInspect('evidence')} />;
  if (sectionId === 'evidence') return <EvidenceDisclosure evidence={investigation.evidence} />;

  return (
    <section className="investigator-section-placeholder" aria-labelledby={`investigator-section-${sectionId}`} data-active="true">
      <p className="investigation-shell__eyebrow">Active investigation section</p>
      <h2 id={`investigator-section-${sectionId}`}>{sectionId[0]?.toUpperCase() + sectionId.slice(1)}</h2>
      <p>Use this section to inspect {sectionId} connected to {investigation.normalizedUrl}.</p>
    </section>
  );
}
