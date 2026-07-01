import PropTypes from 'prop-types';
import { Card, CardContent } from '@/components/ui/card.jsx';
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
          <Card role="status" aria-label="Plugin routes" className="card">
            <CardContent>
              <p>No supported plugin namespaces detected.</p>
            </CardContent>
          </Card>
        )}
      </div>
      {scanResult.plugins.unsupportedNamespaces.length > 0 ? (
        <Card role="status" aria-label="Unsupported namespace notice" className="card card--info" style={{ marginTop: '1rem' }}>
          <CardContent>
            <p>
              Unsupported namespaces recorded:{' '}
              {scanResult.plugins.unsupportedNamespaces.join(', ')}.
              They&apos;ve been added to the persistent tracking list
              under the Unsupported tab.
            </p>
          </CardContent>
        </Card>
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
