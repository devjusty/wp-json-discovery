import PropTypes from 'prop-types';

function ScanStatusStack({
  isScanning,
  activeDomain,
  homepageIsRunning,
  scanError,
  homepageError
}) {
  return (
    <>
      {isScanning ? (
        <div className="card card--info" role="status" aria-live="polite">
          <div className="card__content">
            <p>Scanning {activeDomain}…</p>
          </div>
        </div>
      ) : null}

      {homepageIsRunning ? (
        <div className="card card--info" role="status" aria-live="polite">
          <div className="card__content">
            <p>Analyzing homepage source signals for {activeDomain}…</p>
          </div>
        </div>
      ) : null}

      {scanError ? (
        <div className="card card--error" role="alert">
          <div className="card__content">
            <p>{scanError?.message ?? 'Scan failed.'}</p>
            {scanError?.code === 'auth_required' ? (
              <ul className="error-hints">
                <li>
                  Confirm if the site blocks anonymous REST API access or
                  requires application passwords.
                </li>
                <li>
                  If you have credentials, sign in or create an application
                  password before retrying.
                </li>
                <li>Otherwise, remove this domain from the scan list.</li>
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {homepageError ? (
        <div className="card card--error" role="alert">
          <div className="card__content">
            <p>{homepageError?.message ?? 'Homepage source analysis failed.'}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

ScanStatusStack.propTypes = {
  isScanning: PropTypes.bool,
  activeDomain: PropTypes.string,
  homepageIsRunning: PropTypes.bool,
  scanError: PropTypes.shape({
    code: PropTypes.string,
    message: PropTypes.string
  }),
  homepageError: PropTypes.shape({
    message: PropTypes.string
  })
};

ScanStatusStack.defaultProps = {
  isScanning: false,
  activeDomain: '',
  homepageIsRunning: false,
  scanError: null,
  homepageError: null
};

export default ScanStatusStack;
