import PropTypes from 'prop-types';
import UnsupportedPluginsPanel from '../../../organisms/panels/UnsupportedPluginsPanel.jsx';

function UnsupportedSection({
  unsupportedPlugins,
  unsupportedIsLoading,
  onRefreshUnsupported,
  showDomains
}) {
  return (
    <section className="section">
      <UnsupportedPluginsPanel
        plugins={unsupportedPlugins}
        isLoading={unsupportedIsLoading}
        onRefresh={onRefreshUnsupported}
        showDomains={showDomains}
      />
    </section>
  );
}

UnsupportedSection.propTypes = {
  unsupportedPlugins: PropTypes.array,
  unsupportedIsLoading: PropTypes.bool,
  onRefreshUnsupported: PropTypes.func.isRequired,
  showDomains: PropTypes.bool
};

UnsupportedSection.defaultProps = {
  unsupportedPlugins: [],
  unsupportedIsLoading: false,
  showDomains: false
};

export default UnsupportedSection;
