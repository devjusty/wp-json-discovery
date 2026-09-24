import { useEffect, useState, type ReactNode } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
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

type ScanSettings = {
  capabilityIds: string[];
  options: Record<string, Record<string, unknown>>;
};

type DomainFormProps = {
  onSubmit: (normalized: string, submitted: string) => void;
  isScanning?: boolean;
  initialDomain?: string;
  domain?: string;
  onDomainChange?: (value: string) => void;
  scanSettings?: ScanSettings;
  onScanSettingsChange?: (next: ScanSettings | ((current: ScanSettings) => ScanSettings)) => void;
  onSaveDefaults?: (settings?: ScanSettings) => void;
  /** Optional scan progress (or other status UI) rendered below settings. */
  progressSlot?: ReactNode;
};

function DomainForm({
  onSubmit,
  isScanning,
  initialDomain,
  domain,
  onDomainChange,
  scanSettings,
  onScanSettingsChange,
  onSaveDefaults,
  progressSlot = null
}: DomainFormProps) {
  const isControlled = typeof domain === 'string';
  const [internalDomain, setInternalDomain] = useState(initialDomain ?? '');
  const value = isControlled ? domain : internalDomain;

  useEffect(() => {
    if (!isControlled && initialDomain) {
      setInternalDomain(initialDomain);
    }
  }, [initialDomain, isControlled]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    if (isControlled && onDomainChange) {
      onDomainChange(next);
    } else {
      setInternalDomain(next);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeDomain(value);

    if (!normalized) {
      return;
    }

    onSubmit(normalized, value);
  };

  const isValidDomain = Boolean(normalizeDomain(value));

  return (
    <Card className="domain-form">
      <form onSubmit={handleSubmit}>
        <CardHeader className="">
          <div>
            <h2>WordPress domain</h2>
            <p className="card__meta">
              Paste a WordPress site domain. Protocols and paths are trimmed
              automatically.
            </p>
          </div>
        </CardHeader>
        <CardContent className="">
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
                  children="Scan settings"
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
          {progressSlot ? (
            <div className="domain-form__progress">
              {progressSlot}
            </div>
          ) : null}
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
  onSaveDefaults: PropTypes.func,
  progressSlot: PropTypes.node
};

DomainForm.defaultProps = {
  isScanning: false,
  initialDomain: '',
  domain: undefined,
  onDomainChange: null,
  scanSettings: undefined,
  onScanSettingsChange: null,
  onSaveDefaults: null,
  progressSlot: null
};

export default DomainForm;
