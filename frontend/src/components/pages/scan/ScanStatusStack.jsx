import PropTypes from 'prop-types';
import { Card, CardContent } from '@/components/ui/card.jsx';

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
        <Card className="card card--info" role="status" aria-live="polite">
          <CardContent>
            <p>Scanning {activeDomain}…</p>
          </CardContent>
        </Card>
      ) : null}

      {homepageIsRunning ? (
        <Card className="card card--info" role="status" aria-live="polite">
          <CardContent>
            <p>Analyzing homepage source signals for {activeDomain}…</p>
          </CardContent>
        </Card>
      ) : null}

      {scanError ? (
        <Card className="card card--error" role="alert">
          <CardContent>
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
          </CardContent>
        </Card>
      ) : null}

      {homepageError ? (
        <Card className="card card--error" role="alert">
          <CardContent>
            <p>{homepageError?.message ?? 'Homepage source analysis failed.'}</p>
          </CardContent>
        </Card>
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
