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

function DomainForm({ onSubmit, isScanning, initialDomain }) {
  const [domain, setDomain] = useState(initialDomain ?? '');

  useEffect(() => {
    if (initialDomain) {
      setDomain(initialDomain);
    }
  }, [initialDomain]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalized = normalizeDomain(domain);

    if (!normalized) {
      return;
    }

    onSubmit(normalized);
  };

  const isValidDomain = Boolean(normalizeDomain(domain));

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
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            aria-label="WordPress domain"
          />
          <Button
            type="submit"
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
  initialDomain: PropTypes.string
};

export default DomainForm;
