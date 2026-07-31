import PropTypes from 'prop-types';
import StatusBadge from '../../molecules/StatusBadge.jsx';

function StatChip({ label, hint, value, tone = 'info' }) {
  return (
    <div className="stat-chip">
      <div className="stat-chip__top">
        <span className="stat-chip__label">{label}</span>
        <StatusBadge label={value} tone={tone} />
      </div>
      <div className="stat-chip__hint">{hint}</div>
    </div>
  );
}

StatChip.propTypes = {
  label: PropTypes.string.isRequired,
  hint: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  tone: PropTypes.string
};

StatChip.defaultProps = {
  tone: 'info'
};

function flattenHostRecords(records) {
  if (!Array.isArray(records)) {
    return [];
  }

  return records.flatMap((record) => {
    const host = typeof record?.host === 'string' ? record.host : '';
    const ips = Array.isArray(record?.ips) ? record.ips : [];
    if (ips.length === 0) {
      return [{ host, ip: '', asn: '', asnName: '', country: '' }];
    }
    return ips.map((entry) => ({
      host,
      ip: entry?.ip ?? '',
      asn: entry?.asn ?? '',
      asnName: entry?.asn_name ?? '',
      country: entry?.country ?? entry?.country_code ?? ''
    }));
  });
}

function RecordTable({ title, rows, emptyLabel }) {
  return (
    <div className="recon-panel__table-block">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="card__meta">{emptyLabel}</p>
      ) : (
        <div className="recon-panel__table-wrap">
          <table className="recon-panel__table">
            <thead>
              <tr>
                <th scope="col">Host</th>
                <th scope="col">IP</th>
                <th scope="col">ASN</th>
                <th scope="col">Country</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.host}-${row.ip}-${index}`}>
                  <td>{row.host || '—'}</td>
                  <td>{row.ip || '—'}</td>
                  <td>{row.asn ? `${row.asn}${row.asnName ? ` · ${row.asnName}` : ''}` : '—'}</td>
                  <td>{row.country || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

RecordTable.propTypes = {
  title: PropTypes.string.isRequired,
  rows: PropTypes.arrayOf(PropTypes.shape({
    host: PropTypes.string,
    ip: PropTypes.string,
    asn: PropTypes.string,
    asnName: PropTypes.string,
    country: PropTypes.string
  })).isRequired,
  emptyLabel: PropTypes.string
};

RecordTable.defaultProps = {
  emptyLabel: 'No records found.'
};

function ReconScanPanel({ result }) {
  if (!result) {
    return null;
  }

  const aRows = flattenHostRecords(result.a);
  const nsRows = flattenHostRecords(result.ns);
  const mxRows = flattenHostRecords(result.mx);
  const cnameRows = flattenHostRecords(result.cname);
  const txtRecords = Array.isArray(result.txt) ? result.txt : [];
  const durationLabel = Number.isFinite(result.durationMs)
    ? `${(result.durationMs / 1000).toFixed(1)}s`
    : '—';

  return (
    <div className="recon-panel" aria-label="Domain recon results">
      <div className="stat-chip-row">
        <StatChip label="A records" hint="Hosts with IPs" value={result.totalARecs ?? aRows.length} />
        <StatChip label="NS" hint="Name servers" value={nsRows.length} />
        <StatChip label="MX" hint="Mail exchangers" value={mxRows.length} />
        <StatChip label="TXT" hint="Text records" value={txtRecords.length} />
        <StatChip label="Duration" hint="Lookup time" value={durationLabel} />
      </div>

      <RecordTable title="A records" rows={aRows} emptyLabel="No A records returned." />
      <RecordTable title="NS records" rows={nsRows} emptyLabel="No NS records returned." />
      <RecordTable title="MX records" rows={mxRows} emptyLabel="No MX records returned." />
      <RecordTable title="CNAME records" rows={cnameRows} emptyLabel="No CNAME records returned." />

      <div className="recon-panel__table-block">
        <h3>TXT records</h3>
        {txtRecords.length === 0 ? (
          <p className="card__meta">No TXT records returned.</p>
        ) : (
          <ul className="recon-panel__txt-list">
            {txtRecords.map((entry, index) => (
              <li key={`${entry}-${index}`}>
                <code>{entry}</code>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

ReconScanPanel.propTypes = {
  result: PropTypes.shape({
    durationMs: PropTypes.number,
    totalARecs: PropTypes.number,
    a: PropTypes.array,
    ns: PropTypes.array,
    mx: PropTypes.array,
    cname: PropTypes.array,
    txt: PropTypes.arrayOf(PropTypes.string)
  })
};

ReconScanPanel.defaultProps = {
  result: null
};

export default ReconScanPanel;
