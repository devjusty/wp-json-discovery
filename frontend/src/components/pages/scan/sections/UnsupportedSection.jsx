import PropTypes from 'prop-types';
import UnsupportedPluginsPanel from '../../../organisms/panels/UnsupportedPluginsPanel.jsx';

function UnsupportedSection({
  unsupportedPlugins,
  unsupportedIsLoading,
  onRefreshUnsupported
}) {
  return (
    <section className="section">
      <UnsupportedPluginsPanel
        plugins={unsupportedPlugins}
        isLoading={unsupportedIsLoading}
        onRefresh={onRefreshUnsupported}
      />
    </section>
  );
}

UnsupportedSection.propTypes = {
  unsupportedPlugins: PropTypes.array,
  unsupportedIsLoading: PropTypes.bool,
  onRefreshUnsupported: PropTypes.func.isRequired
};

UnsupportedSection.defaultProps = {
  unsupportedPlugins: [],
  unsupportedIsLoading: false
};

export default UnsupportedSection;
