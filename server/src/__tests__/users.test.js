process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { execute } from '../db/client.js';
import { findOrCreateUser, findUserById, updateUserRole } from '../db/users.js';

beforeAll(async () => {
  await execute('delete from users');
});

afterAll(async () => {
  await execute('delete from users');
});

describe('findOrCreateUser', () => {
  it('creates a new user with standard role by default', async () => {
    const user = await findOrCreateUser('auth0|test1', 'test1@example.com', 'Test One');
    expect(user.id).toBe('auth0|test1');
    expect(user.email).toBe('test1@example.com');
    expect(user.display_name).toBe('Test One');
    expect(user.role).toBe('standard');
    expect(user.created_at).toBeTruthy();
  });

  it('returns existing user without duplicating', async () => {
    const first = await findOrCreateUser('auth0|test2', 'test2@example.com', 'Test Two');
    const second = await findOrCreateUser('auth0|test2', 'changed@example.com', 'Changed Name');
    expect(second.id).toBe(first.id);
    expect(second.created_at).toBe(first.created_at);
    expect(second.email).toBe('test2@example.com');
    expect(second.display_name).toBe('Test Two');
  });
});

describe('findUserById', () => {
  it('returns user by id', async () => {
    await findOrCreateUser('auth0|findme', 'find@example.com', 'Find Me');
    const user = await findUserById('auth0|findme');
    expect(user).not.toBeNull();
    expect(user.email).toBe('find@example.com');
  });

  it('returns null for unknown id', async () => {
    const user = await findUserById('auth0|nonexistent');
    expect(user).toBeNull();
  });
});

describe('updateUserRole', () => {
  it('updates role to admin', async () => {
    await findOrCreateUser('auth0|rolechange', 'role@example.com', 'Role Change');
    const updated = await updateUserRole('auth0|rolechange', 'admin');
    expect(updated.role).toBe('admin');
  });

  it('rejects invalid role', async () => {
    await expect(updateUserRole('auth0|rolechange', 'superadmin')).rejects.toThrow();
  });
});
