import PropTypes from 'prop-types';
import DataTable from '../../../organisms/data/DataTable.jsx';

function CoreDataSection({ scanResult }) {
  return (
    <section className="section">
      <h2>Core data</h2>
      <div className="grid">
        {scanResult.core.map((dataset) => (
          <DataTable
            key={dataset.key}
            domain={scanResult.domain}
            datasetKey={dataset.key}
            title={dataset.label}
            description={dataset.description}
            columns={dataset.columns}
            rows={dataset.rows}
            status={dataset.status}
            error={dataset.error}
          />
        ))}
      </div>
    </section>
  );
}

CoreDataSection.propTypes = {
  scanResult: PropTypes.shape({
    domain: PropTypes.string,
    core: PropTypes.array
  }).isRequired
};

export default CoreDataSection;
