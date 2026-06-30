import { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { request } from '../../api/client.js';

function NoteEditor({ domain, onNoteSaved }) {
  const { isAuthenticated } = useAuth0();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isAuthenticated) return null;

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const result = await request('/api/user/notes', {
        method: 'POST',
        body: JSON.stringify({ domain, note_text: text })
      });
      if (result.ok) {
        setSaved(true);
        setText('');
        onNoteSaved?.();
      }
    } catch {
      // silently handle
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return <span className="badge badge--success">Note saved</span>;
  }

  return (
    <div className="note-editor">
      <textarea
        className="note-editor__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a note about this domain..."
        rows={2}
      />
      <button className="btn btn--sm" onClick={handleSave} disabled={saving || !text.trim()}>
        {saving ? 'Saving...' : 'Save Note'}
      </button>
    </div>
  );
}

export default NoteEditor;
