process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll } from '@jest/globals';
import { execute } from '../db/client.js';
import { findOrCreateUser } from '../db/users.js';
import { createNote, getNotes, updateNote, deleteNote } from '../db/userNotes.js';

beforeAll(async () => {
  await execute('delete from user_notes');
  await findOrCreateUser('auth0|notes', 'notes@example.com', 'Notes User');
});

describe('createNote and getNotes', () => {
  it('creates and retrieves a note', async () => {
    const note = await createNote('auth0|notes', 'example.com', 'Look into this domain');
    expect(note.note_text).toBe('Look into this domain');
    expect(note.domain).toBe('example.com');

    const notes = await getNotes('auth0|notes');
    expect(notes.length).toBeGreaterThanOrEqual(1);
  });

  it('filters notes by domain', async () => {
    await createNote('auth0|notes', 'filter-test.com', 'Filter this');
    const filtered = await getNotes('auth0|notes', 'filter-test.com');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].domain).toBe('filter-test.com');

    const noMatch = await getNotes('auth0|notes', 'nonexistent.com');
    expect(noMatch).toEqual([]);
  });
});

describe('updateNote', () => {
  it('updates note text and updated_at', async () => {
    const note = await createNote('auth0|notes', 'update-test.com', 'Original');
    const updated = await updateNote(note.id, 'auth0|notes', 'Updated text');
    expect(updated.note_text).toBe('Updated text');
    expect(updated.updated_at).toBeTruthy();
  });
});

describe('deleteNote', () => {
  it('deletes a note', async () => {
    const note = await createNote('auth0|notes', 'delete-test.com', 'Delete me');
    await deleteNote(note.id, 'auth0|notes');
    const notes = await getNotes('auth0|notes', 'delete-test.com');
    expect(notes).toEqual([]);
  });
});
