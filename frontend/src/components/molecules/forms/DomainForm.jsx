import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Button from '../../atoms/Button.jsx';
import {
  Card,
  CardContent,
  CardHeader
} from '../../atoms/Card.jsx';
import TextInput from '../../atoms/TextInput.jsx';
import { normalizeDomain } from '../../../utils/format.js';

function DomainForm({
  onSubmit,
  isScanning,
  initialDomain,
  domain,
  onDomainChange
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
    <Card as="form" className="domain-form" onSubmit={handleSubmit}>
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
      </CardContent>
    </Card>
  );
}

DomainForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  isScanning: PropTypes.bool,
  initialDomain: PropTypes.string,
  domain: PropTypes.string,
  onDomainChange: PropTypes.func
};

DomainForm.defaultProps = {
  isScanning: false,
  initialDomain: '',
  domain: undefined,
  onDomainChange: null
};

export default DomainForm;
