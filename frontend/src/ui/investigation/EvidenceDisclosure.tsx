import { useState } from 'react';
import type { Evidence } from '../../domain/investigation/model';

type EvidenceDisclosureProps = Readonly<{
  evidence: ReadonlyArray<Evidence>;
  rawBody?: string;
}>;

const LABELS = { observed: 'Observed', inference: 'Inference', 'request-trace': 'Request trace', absence: 'Absence' } as const;

export function EvidenceDisclosure({ evidence, rawBody }: EvidenceDisclosureProps) {
  const [traceOpen, setTraceOpen] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  const trace = evidence.find(({ kind }) => kind === 'request-trace')?.source.request;

  return (
    <section className="evidence-disclosure" aria-labelledby="evidence-disclosure-title">
      <h2 id="evidence-disclosure-title">Evidence provenance</h2>
      <ul className="evidence-disclosure__list">
        {evidence.map((item) => <li key={item.id}><span className="evidence-disclosure__kind">{LABELS[item.kind]}</span><span>{formatValue(item.value)}</span></li>)}
      </ul>
      {trace ? <div className="evidence-disclosure__details">
        <button type="button" onClick={() => setTraceOpen((open) => !open)} aria-expanded={traceOpen}>{traceOpen ? 'Hide request trace' : 'Show request trace'}</button>
        {traceOpen ? <code>{trace.method} {trace.url}{trace.status ? ` (${trace.status})` : ''}</code> : null}
      </div> : null}
      {rawBody ? <div className="evidence-disclosure__details">
        <button type="button" onClick={() => setBodyOpen((open) => !open)} aria-expanded={bodyOpen}>{bodyOpen ? 'Hide raw body' : 'Show raw body'}</button>
        {bodyOpen ? <pre>{rawBody}</pre> : null}
      </div> : null}
    </section>
  );
}

function formatValue(value: Evidence['value']): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}
