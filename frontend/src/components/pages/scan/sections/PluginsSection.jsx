import PropTypes from 'prop-types';
import PluginSummaryPanel from '../../../organisms/panels/PluginSummaryPanel.jsx';
import PluginRoutesTable from '../../../organisms/data/PluginRoutesTable.jsx';

function PluginsSection({ scanResult }) {
  return (
    <section className="section">
      <h2>Plugin routes</h2>
      <div className="grid">
        <PluginSummaryPanel plugins={scanResult.plugins} />
      </div>
      <div className="grid">
        {scanResult.plugins.matched.length > 0 ? (
          scanResult.plugins.matched.map((plugin) => (
            <PluginRoutesTable
              key={plugin.plugin.id}
              domain={scanResult.domain}
              pluginMatch={plugin}
            />
          ))
        ) : (
          <div className="card">
            <div className="card__content">
              <p>No supported plugin namespaces detected.</p>
            </div>
          </div>
        )}
      </div>
      {scanResult.plugins.unsupportedNamespaces.length > 0 ? (
        <div className="card card--info" style={{ marginTop: '1rem' }}>
          <div className="card__content">
            <p>
              Unsupported namespaces recorded:{' '}
              {scanResult.plugins.unsupportedNamespaces.join(', ')}.
              They&apos;ve been added to the persistent tracking list
              under the Unsupported tab.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

PluginsSection.propTypes = {
  scanResult: PropTypes.shape({
    domain: PropTypes.string,
    plugins: PropTypes.shape({
      matched: PropTypes.array,
      unsupportedNamespaces: PropTypes.array
    })
  }).isRequired
};

export default PluginsSection;
