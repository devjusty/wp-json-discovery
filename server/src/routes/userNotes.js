import { Router } from 'express';
import { wrapAsync } from '../utils/route.js';
import { createNote, getNotes, updateNote, deleteNote } from '../db/userNotes.js';

export default function createUserNotesRoutes() {
  const router = Router();

  router.get('/', wrapAsync(async (req, res) => {
    const domain = req.query.domain || null;
    const notes = await getNotes(req.user.sub, domain);
    res.json({ notes });
  }));

  router.post('/', wrapAsync(async (req, res) => {
    const { domain, note_text } = req.body;
    if (!domain || !note_text) {
      return res.status(400).json({ error: 'domain and note_text are required' });
    }
    const note = await createNote(req.user.sub, domain, note_text);
    res.status(201).json(note);
  }));

  router.put('/:id', wrapAsync(async (req, res) => {
    const { note_text } = req.body;
    if (!note_text) {
      return res.status(400).json({ error: 'note_text is required' });
    }
    const note = await updateNote(Number(req.params.id), req.user.sub, note_text);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  }));

  router.delete('/:id', wrapAsync(async (req, res) => {
    await deleteNote(Number(req.params.id), req.user.sub);
    res.json({ ok: true });
  }));

  return router;
}
