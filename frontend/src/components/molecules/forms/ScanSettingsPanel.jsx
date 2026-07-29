import PropTypes from 'prop-types';
import Button from '../../atoms/Button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import {
  getCapabilityById,
  getRecommendedCapabilityIds,
  normalizeSelection,
  SCAN_CAPABILITIES
} from '../../../services/scanCapabilities.js';

function ScanSettingsPanel({
  scanSettings,
  onScanSettingsChange,
  onSaveDefaults,
  isScanning
}) {
  const normalizedSettings = normalizeSelection(scanSettings);
  const selectedIds = new Set(normalizedSettings.capabilityIds);
  const recommendedLabels = getRecommendedCapabilityIds()
    .map(getCapabilityById)
    .filter(Boolean)
    .map(({ label }) => label);

  const handleCheckedChange = (capabilityId, checked) => {
    if (isScanning || !onScanSettingsChange) {
      return;
    }

    const capabilityIds = checked
      ? [...normalizedSettings.capabilityIds, capabilityId]
      : normalizedSettings.capabilityIds.filter((id) => id !== capabilityId);

    onScanSettingsChange(normalizeSelection({
      capabilityIds,
      options: normalizedSettings.options
    }));
  };

  const handleSaveDefaults = () => {
    onSaveDefaults?.(normalizedSettings);
  };

  return (
    <section className="mt-3 border-t border-border pt-3" aria-label="Scan settings">
      <p className="text-xs text-muted-foreground">
        Recommended: {recommendedLabels.join(' and ')}.
      </p>
      <div className="mt-2 divide-y divide-border">
        {SCAN_CAPABILITIES.map((capability) => {
          const isSelected = selectedIds.has(capability.id);
          const isDisabled = isScanning || capability.required;

          return (
            <label key={capability.id} className="flex items-start gap-3 py-3">
              <Checkbox
                checked={isSelected}
                disabled={isDisabled}
                onCheckedChange={(checked) => handleCheckedChange(capability.id, Boolean(checked))}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-foreground">
                  {capability.label}
                  {capability.required ? ' (required)' : ''}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {capability.description}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Value {capability.value} · Cost {capability.cost}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-3"
        disabled={isScanning || !onSaveDefaults}
        onClick={handleSaveDefaults}
      >
        Save as default
      </Button>
    </section>
  );
}

ScanSettingsPanel.propTypes = {
  scanSettings: PropTypes.shape({
    capabilityIds: PropTypes.arrayOf(PropTypes.string),
    options: PropTypes.object
  }),
  onScanSettingsChange: PropTypes.func,
  onSaveDefaults: PropTypes.func,
  isScanning: PropTypes.bool
};

ScanSettingsPanel.defaultProps = {
  scanSettings: undefined,
  onScanSettingsChange: null,
  onSaveDefaults: null,
  isScanning: false
};

export default ScanSettingsPanel;
