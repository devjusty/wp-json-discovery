import type { Investigation } from '../../domain/investigation/model';

type InvestigatorOverviewProps = Readonly<{
  investigation: Investigation;
  onInspect: (sectionId: string) => void;
}>;

export function InvestigatorOverview({ investigation, onInspect }: InvestigatorOverviewProps) {
  const failed = investigation.capabilities.filter((capability) => capability.status === 'failed' || capability.status === 'unavailable');
  const latestObservation = investigation.observationTimeline.at(-1);

  return (
    <section className="investigator-overview" aria-labelledby="investigator-overview-title">
      <h2 id="investigator-overview-title">Investigator overview</h2>
      <div className="investigator-overview__grid">
        <article className="investigator-panel">
          <h3>What this site is</h3>
          <p className="investigator-panel__lead">{investigation.normalizedUrl}</p>
          <p>Submitted as <code>{investigation.submittedUrl}</code>.</p>
          <p>{investigation.redirectChain.length > 1 ? `Redirected through ${investigation.redirectChain.length} addresses.` : 'No redirect chain observed.'}</p>
          {investigation.redirectChain.length > 1 ? <p className="investigator-panel__trace">Final address <code>{investigation.redirectChain.at(-1)}</code></p> : null}
        </article>
        <article className="investigator-panel">
          <h3>Exposure</h3>
          <p>{investigation.evidence.filter(({ kind }) => kind === 'observed').length} observed signals collected.</p>
          <p>{investigation.evidence.filter(({ kind }) => kind === 'absence').length} absence signals recorded.</p>
          <button type="button" onClick={() => onInspect('evidence')}>Inspect evidence</button>
        </article>
        <article className="investigator-panel">
          <h3>Inspect next</h3>
          <p>{failed.length > 0 ? `${failed.length} capability${failed.length === 1 ? '' : 'ies'} need attention.` : 'Review ranked findings and supporting evidence.'}</p>
          <button type="button" onClick={() => onInspect(failed.length > 0 ? 'tools' : 'findings')}>{failed.length > 0 ? 'Inspect incomplete work' : 'Inspect findings'}</button>
        </article>
        <article className="investigator-panel">
          <h3>Changes</h3>
          <p>{latestObservation ? `Latest observation: ${latestObservation.observedAt}` : 'No observation timeline changes yet.'}</p>
          <p>{investigation.findings.length} ranked finding{investigation.findings.length === 1 ? '' : 's'}.</p>
        </article>
      </div>
    </section>
  );
}
