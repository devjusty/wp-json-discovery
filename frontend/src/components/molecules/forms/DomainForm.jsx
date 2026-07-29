import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Button from '../../atoms/Button.jsx';
import {
  Card,
  CardContent,
  CardHeader
} from '@/components/ui/card.jsx';
import TextInput from '../../atoms/TextInput.jsx';
import { normalizeDomain } from '../../../utils/format.js';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible.jsx';
import ScanSettingsPanel from './ScanSettingsPanel.jsx';

function DomainForm({
  onSubmit,
  isScanning,
  initialDomain,
  domain,
  onDomainChange,
  scanSettings,
  onScanSettingsChange,
  onSaveDefaults
}) {
  const isControlled = typeof domain === 'string';
  const [internalDomain, setInternalDomain] = useState(initialDomain ?? '');
  const value = isControlled ? domain : internalDomain;

  useEffect(() => {
    if (!isControlled && initialDomain) {
      setInternalDomain(initialDomain);
    }
  }, [initialDomain, isControlled]);

  const handleChange = (event) => {
    const next = event.target.value;
    if (isControlled && onDomainChange) {
      onDomainChange(next);
    } else {
      setInternalDomain(next);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalized = normalizeDomain(value);

    if (!normalized) {
      return;
    }

    onSubmit(normalized);
  };

  const isValidDomain = Boolean(normalizeDomain(value));

  return (
    <Card className="domain-form">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <div>
            <h2>WordPress domain</h2>
            <p className="card__meta">
              Paste a WordPress site domain. Protocols and paths are trimmed
              automatically.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <label className="domain-form__label" htmlFor="domain-input">
            Domain
          </label>
          <div className="domain-form__controls">
            <TextInput
              id="domain-input"
              type="text"
              className="domain-form__input"
              placeholder="example.com"
              value={value}
              onChange={handleChange}
              aria-label="WordPress domain"
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="domain-form__button"
              disabled={isScanning || !isValidDomain}
            >
              {isScanning ? 'Scanning…' : 'Start scan'}
            </Button>
          </div>
          <Collapsible>
            <CollapsibleTrigger
              render={(
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  disabled={isScanning}
                />
              )}
            >
              Scan settings
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScanSettingsPanel
                scanSettings={scanSettings}
                onScanSettingsChange={onScanSettingsChange}
                onSaveDefaults={onSaveDefaults}
                isScanning={isScanning}
              />
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </form>
    </Card>
  );
}

DomainForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  isScanning: PropTypes.bool,
  initialDomain: PropTypes.string,
  domain: PropTypes.string,
  onDomainChange: PropTypes.func,
  scanSettings: PropTypes.shape({
    capabilityIds: PropTypes.arrayOf(PropTypes.string),
    options: PropTypes.object
  }),
  onScanSettingsChange: PropTypes.func,
  onSaveDefaults: PropTypes.func
};

DomainForm.defaultProps = {
  isScanning: false,
  initialDomain: '',
  domain: undefined,
  onDomainChange: null,
  scanSettings: undefined,
  onScanSettingsChange: null,
  onSaveDefaults: null
};

export default DomainForm;
