import { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { request } from '../../../api/client.js';

function SaveScanButton({ domain, onSaved }) {
  const { isAuthenticated } = useAuth0();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  if (!isAuthenticated) {
    return null;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await request('/api/user/scans', {
        method: 'POST',
        body: JSON.stringify({ domain })
      });
      if (result.ok) {
        setSaved(true);
        onSaved?.();
      } else {
        setError('Failed to save');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return <span className="badge badge--success">Saved to My Scans</span>;
  }

  return (
    <div>
      <button className="btn btn--sm" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save to My Scans'}
      </button>
      {error ? <p className="text-error">{error}</p> : null}
    </div>
  );
}

export default SaveScanButton;
