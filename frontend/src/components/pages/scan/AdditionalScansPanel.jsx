import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button.jsx';
import { SCAN_CAPABILITIES } from '../../../services/scanCapabilities.js';

function AdditionalScansPanel({ selectedCapabilityIds, capabilities, onRunCapability }) {
  const selectedIds = new Set(selectedCapabilityIds);
  const availableCapabilities = SCAN_CAPABILITIES.filter((capability) => (
    !capability.required
    && capability.availability()
    && !selectedIds.has(capability.id)
    && ['idle', undefined].includes(capabilities[capability.id]?.status)
  ));

  if (availableCapabilities.length === 0) {
    return null;
  }

  return (
    <section className="section" aria-label="Additional scans">
      <h2>Additional scans</h2>
      {availableCapabilities.map((capability) => (
        <div key={capability.id}>
          <strong>{capability.label}</strong>
          <p className="card__meta">{capability.description}</p>
          {capability.defaultOptions.maxPages ? (
            <p className="card__meta">Default max pages: {capability.defaultOptions.maxPages}</p>
          ) : null}
          <Button type="button" variant="secondary" size="sm" onClick={() => onRunCapability(capability.id, capability.defaultOptions)}>
            Run {capability.label}
          </Button>
        </div>
      ))}
    </section>
  );
}

AdditionalScansPanel.propTypes = {
  selectedCapabilityIds: PropTypes.arrayOf(PropTypes.string),
  capabilities: PropTypes.object,
  onRunCapability: PropTypes.func
};

AdditionalScansPanel.defaultProps = {
  selectedCapabilityIds: [],
  capabilities: {},
  onRunCapability: () => {}
};

export default AdditionalScansPanel;
