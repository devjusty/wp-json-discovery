import { useState } from 'react';
import type { Evidence } from '../../domain/investigation/model';

type EvidenceDisclosureProps = Readonly<{
  evidence: ReadonlyArray<Evidence>;
  rawBody?: string;
}>;

const LABELS = { observed: 'Observed', inference: 'Inference', 'request-trace': 'Request trace', absence: 'Absence' } as const;

export function EvidenceDisclosure({ evidence, rawBody }: EvidenceDisclosureProps) {
  const [openTraceIds, setOpenTraceIds] = useState<ReadonlySet<string>>(new Set());
  const [bodyOpen, setBodyOpen] = useState(false);

  return (
    <section className="evidence-disclosure" aria-labelledby="evidence-disclosure-title">
      <h2 id="evidence-disclosure-title">Evidence provenance</h2>
      <ul className="evidence-disclosure__list">
        {evidence.map((item) => {
          const trace = item.kind === 'request-trace' ? item.source.request : undefined;
          const traceOpen = openTraceIds.has(item.id);
          return <li key={item.id}>
            <span className="evidence-disclosure__kind">{LABELS[item.kind]}</span>
            <span>{formatValue(item.value)}</span>
            {item.source.locator ? <span>Locator {item.source.locator}</span> : null}
            {item.source.observedAt ? <span>Observed {item.source.observedAt}</span> : null}
            {item.source.evidenceIds?.length ? <span>Related evidence {item.source.evidenceIds.join(', ')}</span> : null}
            {trace ? <div className="evidence-disclosure__details">
              <button type="button" onClick={() => setOpenTraceIds((current) => {
                const next = new Set(current);
                if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                return next;
              })} aria-expanded={traceOpen}>{traceOpen ? 'Hide request trace' : 'Show request trace'}</button>
              {traceOpen ? <code>{trace.method} {trace.url}{trace.status ? ` (${trace.status})` : ''}</code> : null}
            </div> : null}
          </li>;
        })}
      </ul>
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
