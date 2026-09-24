import type { Investigation } from '../../domain/investigation/model';
import type { InvestigatorCapabilityStatus } from '../../adapters/investigatorReadModel';

type CapabilitySummary = Readonly<{ name: string; status: InvestigatorCapabilityStatus; retryable?: boolean }>;

export function InvestigatorAssetsPanel({ investigation }: Readonly<{ investigation: Investigation }>) {
  return (
    <section className="investigator-section-placeholder" aria-labelledby="investigator-assets-title" data-active="true">
      <p className="investigation-shell__eyebrow">Collected surface</p>
      <h2 id="investigator-assets-title">Assets</h2>
      <p>{investigation.evidence.length} evidence records currently identify assets or exposed surfaces.</p>
      <ul className="investigator-panel__list">
        {investigation.evidence.slice(0, 6).map((item) => <li key={item.id}><strong>{item.capability}</strong><span>{item.source.locator || item.id}</span></li>)}
      </ul>
    </section>
  );
}

export function InvestigatorHistoryPanel({ investigation }: Readonly<{ investigation: Investigation }>) {
  return (
    <section className="investigator-section-placeholder" aria-labelledby="investigator-history-title" data-active="true">
      <p className="investigation-shell__eyebrow">Investigation timeline</p>
      <h2 id="investigator-history-title">History</h2>
      <p>Investigation started {investigation.createdAt}.</p>
      <p>{investigation.observationTimeline.length} observation{investigation.observationTimeline.length === 1 ? '' : 's'} recorded in current session.</p>
    </section>
  );
}

export function InvestigatorToolsPanel({ capabilities, onRetry }: Readonly<{
  capabilities: ReadonlyArray<CapabilitySummary>;
  onRetry?: (capabilityName: string) => void;
}>) {
  return (
    <section className="investigator-section-placeholder" aria-labelledby="investigator-tools-title" data-active="true">
      <p className="investigator-shell__eyebrow">Capability controls</p>
      <h2 id="investigator-tools-title">Tools</h2>
      {capabilities.length === 0 ? <p>No capabilities selected.</p> : (
        <ul className="investigator-panel__list">
          {capabilities.map((capability) => <li key={capability.name}>
            <span><strong>{capability.name}</strong> {capability.status}</span>
            {capability.retryable && onRetry ? <button type="button" onClick={() => onRetry(capability.name)}>Retry</button> : null}
          </li>)}
        </ul>
      )}
    </section>
  );
}
