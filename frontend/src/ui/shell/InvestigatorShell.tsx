import type { ReactNode } from 'react';
import type { CapabilityStatus } from '../../domain/investigation/model';
import { AppShell, type ShellNavigation } from './AppShell';
import { InvestigatorSectionSelector, type InvestigatorSection } from '../investigation/InvestigatorSectionSelector';

export type InvestigatorShellReadModel = Readonly<{
  title: string;
  status: 'complete' | 'partial' | 'failed' | 'blocked' | 'incomplete';
  sections: ReadonlyArray<InvestigatorSection>;
  capabilities: ReadonlyArray<Readonly<{
    name: string;
    status: CapabilityStatus;
    retryable?: boolean;
  }>>;
}>;

type InvestigatorShellProps = Readonly<{
  readModel: InvestigatorShellReadModel;
  commands: Readonly<{ onSectionChange: (sectionId: string) => void; onRetry?: (capabilityName: string) => void }>;
  activeSection?: string;
  children: ReactNode;
}>;

export function InvestigatorShell({ readModel, commands, activeSection = readModel.sections[0]?.id ?? '', children }: InvestigatorShellProps) {
  const navigation: ShellNavigation = { items: readModel.sections, activeId: activeSection };
  const isPartial = readModel.status === 'partial' || readModel.status === 'failed';
  const successfulCapabilityExists = readModel.capabilities.some(({ status }) => status === 'success');
  const retryableCapabilities = readModel.capabilities.filter(({ status, retryable }) => status === 'failed' && retryable);

  return (
    <AppShell navigation={navigation} commands={{ onNavigate: commands.onSectionChange }} title={readModel.title} navigationLabel="Investigator navigation">
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
      {children}
    </AppShell>
  );
}
