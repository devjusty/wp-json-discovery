import type { Investigation } from '../../domain/investigation/model';

type InvestigatorFindingsProps = Readonly<{
  investigation: Investigation;
  onSelectEvidence: (evidenceIds: ReadonlyArray<string>) => void;
}>;

export function InvestigatorFindings({ investigation, onSelectEvidence }: InvestigatorFindingsProps) {
  const findings = investigation.findings;

  return (
    <section className="investigator-findings" aria-labelledby="investigator-findings-title">
      <div className="investigator-section-heading">
        <div><p className="investigator-shell__eyebrow">Prioritized signals</p><h2 id="investigator-findings-title">Ranked findings</h2></div>
        <span className="investigator-status">{findings.length} total</span>
      </div>
      {findings.length === 0 ? <p className="investigator-empty">No findings recorded yet.</p> : (
        <ol className="investigator-findings__list">
          {findings.map((finding) => (
            <li key={finding.id} className="investigator-finding">
              <div>
                <p className="investigator-finding__capability">{finding.capability}</p>
                <h3>{finding.summary}</h3>
                <span className={`investigator-confidence investigator-confidence--${finding.confidence}`}>{finding.confidence} confidence</span>
              </div>
              {finding.evidenceIds.length > 0 ? <button type="button" onClick={() => onSelectEvidence(finding.evidenceIds)}>View evidence</button> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
