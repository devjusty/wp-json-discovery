import type { ReactNode } from 'react';
import { AppShell, type ShellNavigation } from './AppShell';
import { InvestigatorSectionSelector, type InvestigatorSection } from '../investigation/InvestigatorSectionSelector';

export type InvestigatorShellReadModel = Readonly<{
  title: string;
  status: 'complete' | 'partial' | 'failed' | 'blocked' | 'incomplete';
  sections: ReadonlyArray<InvestigatorSection>;
}>;

type InvestigatorShellProps = Readonly<{
  readModel: InvestigatorShellReadModel;
  commands: Readonly<{ onSectionChange: (sectionId: string) => void; onRetry?: () => void }>;
  activeSection?: string;
  children: ReactNode;
}>;

export function InvestigatorShell({ readModel, commands, activeSection = readModel.sections[0]?.id ?? '', children }: InvestigatorShellProps) {
  const navigation: ShellNavigation = { items: readModel.sections, activeId: activeSection };
  const isPartial = readModel.status === 'partial' || readModel.status === 'failed';

  return (
    <AppShell navigation={navigation} commands={{ onNavigate: commands.onSectionChange }} title={readModel.title} navigationLabel="Investigator navigation">
      <div className="investigator-shell__section-selector"><InvestigatorSectionSelector sections={readModel.sections} activeSection={activeSection} onChange={commands.onSectionChange} /></div>
      {isPartial ? <div className="investigator-partial" role="status"><strong>{readModel.status === 'failed' ? 'Investigation failed' : 'Partial investigation'}</strong><span>Successful evidence remains available.</span>{commands.onRetry ? <button type="button" onClick={commands.onRetry}>Retry failed capability</button> : null}</div> : null}
      {children}
    </AppShell>
  );
}
