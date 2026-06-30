import { queryAll, queryOne, execute } from './client.js';

export async function createNote(userId, domain, noteText) {
  const now = new Date().toISOString();
  await execute(
    'insert into user_notes (user_id, domain, note_text, created_at, updated_at) values (?, ?, ?, ?, ?)',
    [userId, domain, noteText, now, now]
  );
  return queryOne(
    'select * from user_notes where user_id = ? and domain = ? and created_at = ?',
    [userId, domain, now]
  );
}

export async function getNotes(userId, domain = null) {
  if (domain) {
    return queryAll(
      'select * from user_notes where user_id = ? and domain = ? order by created_at desc',
      [userId, domain]
    );
  }
  return queryAll(
    'select * from user_notes where user_id = ? order by created_at desc',
    [userId]
  );
}

export async function updateNote(noteId, userId, noteText) {
  const now = new Date().toISOString();
  await execute(
    'update user_notes set note_text = ?, updated_at = ? where id = ? and user_id = ?',
    [noteText, now, noteId, userId]
  );
  return queryOne('select * from user_notes where id = ?', [noteId]);
}

export async function deleteNote(noteId, userId) {
  await execute(
    'delete from user_notes where id = ? and user_id = ?',
    [noteId, userId]
  );
}
