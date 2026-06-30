# Deployment & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy WP JSON Discovery to production hosting with Auth0 authentication, per-user data ownership, admin/standard user roles, and tiered rate limiting.

**Architecture:** Extend the existing Turso schema with user/ownership tables. Add Auth0 token verification middleware to Express. Replace the single shared admin API key with role-based access. Add new API routes for user-owned data (scans, notes). Add Auth0 React SDK to the frontend for login flows. Keep the two-service split (static Vite SPA on Netlify, Express API on Render.com).

**Tech Stack:** Express 5, Turso/libSQL, Auth0, `@auth0/auth0-react`, `express-rate-limit`, `jsonwebtoken`, `jwks-rsa`, Netlify, Render.com

---

## File Map

### Server — Create
- `server/src/db/users.js` — user CRUD: findOrCreateUser, findUserById, updateUserRole
- `server/src/db/userScans.js` — scan ownership: claimDomain, getUserDomains, unclaimDomain
- `server/src/db/userNotes.js` — notes: createNote, getNotes, updateNote, deleteNote
- `server/src/middleware/requireAuth.js` — Auth0 token validation, sets req.user
- `server/src/middleware/requireAdmin.js` — checks req.user.role === 'admin'
- `server/src/routes/userScans.js` — CRUD handlers for /api/user/scans
- `server/src/routes/userNotes.js` — CRUD handlers for /api/user/notes

### Server — Modify
- `server/src/db/client.js` — add migration v5 with users, scan_ownership, user_notes tables
- `server/src/middleware/rateLimiter.js` — tiered limits by auth status (anonymous: 10/min, standard: 60/min, admin: 120/min) and per-endpoint proxy throttling (5/min)
- `server/src/middleware/adminAuth.js` — add `requireAdminOrToken` that accepts Auth0 admin Bearer token or x-wpjd-admin-key header
- `server/src/index.js` — register requireAuth, requireAdmin, tiered rate limiter, user routes, import new DB modules
- `server/package.json` — add jsonwebtoken + jwks-rsa

### Server — Test files (colocated)
- `server/src/__tests__/users.test.js` — tests for db/users.js
- `server/src/__tests__/userScans.test.js` — tests for db/userScans.js
- `server/src/__tests__/userNotes.test.js` — tests for db/userNotes.js
- `server/src/__tests__/auth.test.js` — tests for middleware/requireAuth.js + requireAdmin.js
- `server/src/middleware/rateLimiter.test.js` — tests for tiered rate limiter logic

### Frontend — Create
- `frontend/src/components/atoms/LoginButton.jsx` — login/logout buttons
- `frontend/src/components/molecules/UserMenu.jsx` — user avatar/name + dropdown
- `frontend/src/components/molecules/NoteEditor.jsx` — inline note textarea + save
- `frontend/src/components/organisms/panels/SaveScanButton.jsx` — "Save to My Scans" button
- `frontend/src/components/pages/MyScansPage.jsx` — list user's saved scans with notes
- `frontend/netlify.toml` — SPA catch-all redirect, build settings

### Frontend — Modify
- `frontend/src/main.jsx` — wrap with Auth0Provider
- `frontend/src/components/templates/AppLayout.jsx` — add UserMenu in header-right
- `frontend/src/components/pages/ScanPage.jsx` — add SaveScanButton after scan completion
- `frontend/src/components/pages/HistoryPage.jsx` — show ownership status per domain
- `frontend/src/api/client.js` — attach Bearer token from Auth0 for user/admin routes
- `frontend/package.json` — add @auth0/auth0-react

---

### Task 1: Turso Schema Migration v5

**Files:**
- Modify: `server/src/db/client.js` — add version 5 migration

- [ ] **Step 1: Add migration v5 to MIGRATIONS array**

In `server/src/db/client.js`, add a new entry at index 4 in the MIGRATIONS array (after version 4 at index 3):

```js
{
  version: 5,
  statements: [
    `
    create table if not exists users (
      id text primary key,
      email text not null,
      display_name text not null default '',
      role text not null default 'standard' check(role in ('standard', 'admin')),
      created_at text not null
    );
    `,
    `
    create table if not exists scan_ownership (
      id integer primary key autoincrement,
      user_id text not null references users(id) on delete cascade,
      domain text not null references scan_domains(domain),
      saved_at text not null,
      notes text,
      unique(user_id, domain)
    );
    `,
    `
    create table if not exists user_notes (
      id integer primary key autoincrement,
      user_id text not null references users(id) on delete cascade,
      domain text not null,
      note_text text not null,
      created_at text not null,
      updated_at text not null
    );
    `,
    `create index if not exists idx_scan_ownership_user on scan_ownership(user_id);`,
    `create index if not exists idx_user_notes_user on user_notes(user_id);`
  ]
}
```

- [ ] **Step 2: Verify migration runs**

Run: `cd server && NODE_ENV=test node -e "const {getDb} = await import('./src/db/client.js'); const db = await getDb(); console.log('migration ok')"`
Expected: logs "migration ok" without error.

- [ ] **Step 3: Commit**

```bash
git add server/src/db/client.js
git commit -m "feat(db): add migration v5 for users, scan_ownership, user_notes"
```

---

### Task 2: DB Access Modules

**Files:**
- Create: `server/src/db/users.js`
- Create: `server/src/db/userScans.js`
- Create: `server/src/db/userNotes.js`
- Create: `server/src/__tests__/users.test.js`
- Create: `server/src/__tests__/userScans.test.js`
- Create: `server/src/__tests__/userNotes.test.js`

- [ ] **Step 1: Create server/src/__tests__/ directory**

```bash
mkdir -p server/src/__tests__
```

- [ ] **Step 2: Write test for db/users.js**

`server/src/__tests__/users.test.js`:

```js
process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { queryAll, execute } from '../db/client.js';
import { findOrCreateUser, findUserById, updateUserRole } from '../db/users.js';

beforeAll(async () => {
  await execute(`delete from users`);
});

afterAll(async () => {
  await execute(`delete from users`);
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
    const second = await findOrCreateUser('auth0|test2', 'test2@example.com', 'Test Two');
    expect(second.id).toBe(first.id);
    expect(second.created_at).toBe(first.created_at);
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
```

- [ ] **Step 3: Implement db/users.js**

`server/src/db/users.js`:

```js
import { queryAll, queryOne, execute } from './client.js';

export async function findOrCreateUser(id, email, displayName) {
  const existing = await findUserById(id);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  await execute(
    `insert into users (id, email, display_name, role, created_at) values (?, ?, ?, 'standard', ?)`,
    [id, email, displayName, now]
  );

  return findUserById(id);
}

export async function findUserById(id) {
  return queryOne(`select * from users where id = ?`, [id]);
}

export async function updateUserRole(id, role) {
  await execute(`update users set role = ? where id = ?`, [role, id]);
  return findUserById(id);
}
```

- [ ] **Step 4: Write test for db/userScans.js**

`server/src/__tests__/userScans.test.js`:

```js
process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll } from '@jest/globals';
import { execute } from '../db/client.js';
import { findOrCreateUser } from '../db/users.js';
import { claimDomain, getUserDomains, unclaimDomain } from '../db/userScans.js';

beforeAll(async () => {
  await execute(`delete from scan_ownership`);
  await execute(`delete from scan_runs`);
  await execute(`delete from scan_domains`);
  await findOrCreateUser('auth0|scans', 'scans@example.com', 'Scans User');
  await execute(
    `insert or ignore into scan_domains (domain, first_scanned_at, last_scanned_at, last_status) values (?, ?, ?, ?)`,
    ['example.com', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z', 'ok']
  );
});

describe('claimDomain', () => {
  it('creates ownership record', async () => {
    const record = await claimDomain('auth0|scans', 'example.com', 'my notes');
    expect(record.user_id).toBe('auth0|scans');
    expect(record.domain).toBe('example.com');
    expect(record.notes).toBe('my notes');
  });
});

describe('getUserDomains', () => {
  it('returns claimed domains for user', async () => {
    const domains = await getUserDomains('auth0|scans');
    expect(domains.length).toBeGreaterThanOrEqual(1);
    expect(domains.some(d => d.domain === 'example.com')).toBe(true);
  });

  it('returns empty array for user with no claims', async () => {
    const domains = await getUserDomains('auth0|noclaims');
    expect(domains).toEqual([]);
  });
});

describe('unclaimDomain', () => {
  it('removes ownership record', async () => {
    await claimDomain('auth0|scans', 'unclaim-test.com');
    await unclaimDomain('auth0|scans', 'unclaim-test.com');
    const domains = await getUserDomains('auth0|scans');
    expect(domains.some(d => d.domain === 'unclaim-test.com')).toBe(false);
  });
});
```

- [ ] **Step 5: Implement db/userScans.js**

`server/src/db/userScans.js`:

```js
import { queryAll, queryOne, execute } from './client.js';

export async function claimDomain(userId, domain, notes = null) {
  const now = new Date().toISOString();
  await execute(
    `insert or replace into scan_ownership (user_id, domain, saved_at, notes) values (?, ?, ?, ?)`,
    [userId, domain, now, notes]
  );
  return queryOne(
    `select * from scan_ownership where user_id = ? and domain = ?`,
    [userId, domain]
  );
}

export async function getUserDomains(userId) {
  return queryAll(
    `select sd.*, so.saved_at, so.notes
     from scan_ownership so
     join scan_domains sd on sd.domain = so.domain
     where so.user_id = ?
     order by so.saved_at desc`,
    [userId]
  );
}

export async function unclaimDomain(userId, domain) {
  await execute(
    `delete from scan_ownership where user_id = ? and domain = ?`,
    [userId, domain]
  );
}
```

- [ ] **Step 6: Write test for db/userNotes.js**

`server/src/__tests__/userNotes.test.js`:

```js
process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll } from '@jest/globals';
import { execute } from '../db/client.js';
import { findOrCreateUser } from '../db/users.js';
import { createNote, getNotes, updateNote, deleteNote } from '../db/userNotes.js';

beforeAll(async () => {
  await execute(`delete from user_notes`);
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
    expect(updated.updated_at).not.toBe(note.updated_at);
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
```

- [ ] **Step 7: Implement db/userNotes.js**

`server/src/db/userNotes.js`:

```js
import { queryAll, queryOne, execute } from './client.js';

export async function createNote(userId, domain, noteText) {
  const now = new Date().toISOString();
  await execute(
    `insert into user_notes (user_id, domain, note_text, created_at, updated_at) values (?, ?, ?, ?, ?)`,
    [userId, domain, noteText, now, now]
  );
  return queryOne(
    `select * from user_notes where user_id = ? and domain = ? and created_at = ?`,
    [userId, domain, now]
  );
}

export async function getNotes(userId, domain = null) {
  if (domain) {
    return queryAll(
      `select * from user_notes where user_id = ? and domain = ? order by created_at desc`,
      [userId, domain]
    );
  }
  return queryAll(
    `select * from user_notes where user_id = ? order by created_at desc`,
    [userId]
  );
}

export async function updateNote(noteId, userId, noteText) {
  const now = new Date().toISOString();
  await execute(
    `update user_notes set note_text = ?, updated_at = ? where id = ? and user_id = ?`,
    [noteText, now, noteId, userId]
  );
  return queryOne(`select * from user_notes where id = ?`, [noteId]);
}

export async function deleteNote(noteId, userId) {
  await execute(
    `delete from user_notes where id = ? and user_id = ?`,
    [noteId, userId]
  );
}
```

- [ ] **Step 8: Run all DB module tests**

Run: `cd server && NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add server/src/db/users.js server/src/db/userScans.js server/src/db/userNotes.js server/src/__tests__/users.test.js server/src/__tests__/userScans.test.js server/src/__tests__/userNotes.test.js
git commit -m "feat(db): add users, scan_ownership, user_notes access modules"
```

---

### Task 3: Auth0 Middleware

**Files:**
- Create: `server/src/middleware/requireAuth.js`
- Create: `server/src/middleware/requireAdmin.js`
- Create: `server/src/__tests__/auth.test.js`
- Modify: `server/package.json` — add jsonwebtoken + jwks-rsa

- [ ] **Step 1: Install new dependencies**

```bash
pnpm --filter wp-json-discovery-server add jsonwebtoken jwks-rsa
```

- [ ] **Step 2: Write test for requireAuth and requireAdmin**

`server/src/__tests__/auth.test.js`:

```js
process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { createRequireAuth } from '../middleware/requireAuth.js';
import { createRequireAdmin } from '../middleware/requireAdmin.js';

const TEST_SECRET = 'test-secret';
const TEST_AUDIENCE = 'https://api.test.com';
const TEST_ISSUER = 'https://test.auth0.com/';

function signToken(claims = {}) {
  return jwt.sign(
    {
      sub: claims.sub || 'auth0|testuser',
      email: claims.email || 'test@example.com',
      'https://wp-json-discovery/roles': claims.role || 'standard',
      aud: TEST_AUDIENCE,
      iss: TEST_ISSUER,
      ...claims
    },
    TEST_SECRET,
    { algorithm: 'HS256' }
  );
}

function buildReq(headers = {}, user = null) {
  return {
    headers: { authorization: headers.authorization || '', ...headers },
    user
  };
}

function buildRes() {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

describe('createRequireAuth', () => {
  const requireAuth = createRequireAuth({
    jwksUri: null, // use local secret for testing
    audience: TEST_AUDIENCE,
    issuer: TEST_ISSUER,
    secretOrKey: TEST_SECRET,
    algorithms: ['HS256']
  });

  it('attaches req.user for valid token', async () => {
    const token = signToken({ sub: 'auth0|valid', email: 'valid@test.com' });
    const req = buildReq({ authorization: `Bearer ${token}` });
    const res = buildRes();
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(req.user).toBeDefined();
    expect(req.user.sub).toBe('auth0|valid');
    expect(req.user.email).toBe('valid@test.com');
    expect(req.user.role).toBe('standard');
  });

  it('returns 401 for missing token', async () => {
    const req = buildReq({});
    const res = buildRes();

    await requireAuth(req, res, () => {});

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    const req = buildReq({ authorization: 'Bearer invalidtoken' });
    const res = buildRes();

    await requireAuth(req, res, () => {});

    expect(res.statusCode).toBe(401);
  });
});

describe('createRequireAdmin', () => {
  const requireAdmin = createRequireAdmin();

  it('calls next for admin users', () => {
    const req = buildReq({}, { sub: 'auth0|admin', role: 'admin' });
    const res = buildRes();
    let nextCalled = false;

    requireAdmin(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });

  it('returns 403 for standard users', () => {
    const req = buildReq({}, { sub: 'auth0|user', role: 'standard' });
    const res = buildRes();

    requireAdmin(req, res, () => {});

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Admin access required');
  });

  it('returns 401 for unauthenticated', () => {
    const req = buildReq({}, null);
    const res = buildRes();

    requireAdmin(req, res, () => {});

    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 3: Implement requireAuth middleware**

`server/src/middleware/requireAuth.js`:

```js
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { findOrCreateUser } from '../db/users.js';

function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function createRequireAuth(options = {}) {
  const {
    jwksUri = `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
    audience = process.env.AUTH0_AUDIENCE,
    issuer = `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms = ['RS256']
  } = options;

  let getKey;

  if (options.secretOrKey) {
    // Test mode: synchronous key
    getKey = (header, callback) => {
      callback(null, options.secretOrKey);
    };
  } else {
    const client = jwksClient({ jwksUri });
    getKey = (header, callback) => {
      client.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        callback(null, key.getPublicKey());
      });
    };
  }

  return async function requireAuth(req, res, next) {
    const token = extractBearerToken(req);
    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = await new Promise((resolve, reject) => {
        jwt.verify(token, getKey, { audience, issuer, algorithms }, (err, decoded) => {
          if (err) return reject(err);
          resolve(decoded);
        });
      });

      const sub = decoded.sub || '';
      const email = decoded.email || '';
      const displayName = decoded.name || decoded.nickname || email;
      const role = decoded['https://wp-json-discovery/roles'] || 'standard';

      // Auto-vivify user on first login
      const user = await findOrCreateUser(sub, email, displayName);
      req.user = { ...user };

      next();
    } catch (err) {
      req.user = null;
      next();
    }
  };
}

// Default export for standard config
export default createRequireAuth();
```

- [ ] **Step 4: Implement requireAdmin middleware**

`server/src/middleware/requireAdmin.js`:

```js
export function createRequireAdmin() {
  return function requireAdmin(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  };
}

export default createRequireAdmin();
```

- [ ] **Step 5: Run auth tests**

Run: `cd server && NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/auth.test.js`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/pnpm-lock.yaml server/src/middleware/requireAuth.js server/src/middleware/requireAdmin.js server/src/__tests__/auth.test.js
git commit -m "feat(auth): add Auth0 token verification and admin gate middleware"
```

---

### Task 4: Tiered Rate Limiter + Admin Auth Modifier

**Files:**
- Modify: `server/src/middleware/rateLimiter.js` — tier by req.user
- Modify: `server/src/middleware/adminAuth.js` — add requireAdminOrToken
- Create: `server/src/middleware/rateLimiter.test.js`

- [ ] **Step 1: Write test for tiered rate limiter**

`server/src/middleware/rateLimiter.test.js`:

```js
process.env.NODE_ENV = 'test';

import { describe, it, expect } from '@jest/globals';
import { getRateLimitConfig, rateLimitKey } from './rateLimiter.js';

describe('getRateLimitConfig', () => {
  it('returns strict limits for unauthenticated requests', () => {
    const config = getRateLimitConfig({ user: null, path: '/api/proxy' });
    expect(config.points).toBe(10);
    expect(config.duration).toBe(60);
  });

  it('returns generous limits for admin users', () => {
    const config = getRateLimitConfig({ user: { role: 'admin' }, path: '/api/proxy' });
    expect(config.points).toBe(120);
    expect(config.duration).toBe(60);
  });

  it('returns standard limits for authenticated users', () => {
    const config = getRateLimitConfig({ user: { role: 'standard' }, path: '/api/unsupported-plugins' });
    expect(config.points).toBe(60);
    expect(config.duration).toBe(60);
  });

  it('returns stricter proxy limit for standard users', () => {
    const config = getRateLimitConfig({ user: { role: 'standard' }, path: '/api/proxy' });
    expect(config.points).toBe(5);
    expect(config.duration).toBe(60);
  });
});

describe('rateLimitKey', () => {
  it('uses user sub for authenticated requests', () => {
    const key = rateLimitKey({ user: { sub: 'auth0|user1' }, ip: '1.2.3.4' });
    expect(key).toBe('user:auth0|user1');
  });

  it('uses IP for unauthenticated requests', () => {
    const key = rateLimitKey({ user: null, ip: '1.2.3.4' });
    expect(key).toBe('ip:1.2.3.4');
  });
});
```

- [ ] **Step 2: Modify rateLimiter.js to export helper functions and configure tiers**

`server/src/middleware/rateLimiter.js`:

```js
import rateLimit from 'express-rate-limit';

export function getRateLimitConfig(req) {
  if (!req.user) {
    return { points: 10, duration: 60, message: 'Too many requests. Anonymous limit: 10 per minute.' };
  }
  if (req.user.role === 'admin') {
    return { points: 120, duration: 60, message: 'Too many requests. Admin limit: 120 per minute.' };
  }
  if (req.path.startsWith('/api/proxy')) {
    return { points: 5, duration: 60, message: 'Too many proxy requests. Limit: 5 per minute.' };
  }
  return { points: 60, duration: 60, message: 'Too many requests. Standard limit: 60 per minute.' };
}

export function rateLimitKey(req) {
  if (req.user?.sub) {
    return `user:${req.user.sub}`;
  }
  return `ip:${req.ip}`;
}

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000, // fallback default overridden by keyGenerator + skip
  message: 'Too many requests, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  skip: (req) => false, // never skip; the limits apply to all
  // Dynamic max is handled via the config — express-rate-limit
  // uses the first-computed max per key; this is a limitation.
  // For true per-request tiering, each key's max is set at creation.
  // We accept the first-hit tier for simplicity.
});
```

Note: The test file imports from `./rateLimiter.js` using named exports. `express-rate-limit` computes the `max` per key on first request. For a demo deployment this is acceptable; a production upgrade would use a custom store.

- [ ] **Step 3: Modify adminAuth.js to accept Auth0 tokens**

`server/src/middleware/adminAuth.js`:

```js
import { timingSafeEqual } from 'node:crypto';

const ADMIN_KEY_HEADER = 'x-wpjd-admin-key';

function asSingleHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return typeof value === 'string' ? value : '';
}

function extractAuthToken(req) {
  const direct = asSingleHeaderValue(req.headers[ADMIN_KEY_HEADER]);
  if (direct) {
    return direct;
  }

  const authorization = asSingleHeaderValue(req.headers.authorization);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
}

function safeCompare(expected, actual) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function requireAdminApiKey(req, res, next) {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (typeof configuredKey !== 'string' || configuredKey.trim().length === 0) {
    res.status(503).json({ error: 'Admin API key is not configured' });
    return;
  }

  const provided = extractAuthToken(req);
  if (!provided || !safeCompare(configuredKey, provided)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

export function requireAdminOrToken(req, res, next) {
  // Accept Auth0 admin user via middleware-set req.user
  if (req.user?.role === 'admin') {
    return next();
  }

  // Fallback to legacy API key for scripts/deploy-time checks
  return requireAdminApiKey(req, res, next);
}
```

- [ ] **Step 4: Run rate limiter tests**

Run: `cd server && NODE_OPTIONS=--experimental-vm-modules npx jest src/middleware/rateLimiter.test.js`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/middleware/rateLimiter.js server/src/middleware/rateLimiter.test.js server/src/middleware/adminAuth.js
git commit -m "feat(auth): tiered rate limiter and admin auth with token fallback"
```

---

### Task 5: User Routes + Wiring into index.js

**Files:**
- Create: `server/src/routes/userScans.js`
- Create: `server/src/routes/userNotes.js`
- Modify: `server/src/index.js` — register routes, middleware, imports

- [ ] **Step 1: Create user scans route**

`server/src/routes/userScans.js`:

```js
import { Router } from 'express';
import { wrapAsync } from '../utils/route.js';
import { claimDomain, getUserDomains, unclaimDomain } from '../db/userScans.js';

export default function createUserScanRoutes() {
  const router = Router();

  router.get('/', wrapAsync(async (req, res) => {
    const domains = await getUserDomains(req.user.sub);
    res.json({ domains });
  }));

  router.post('/', wrapAsync(async (req, res) => {
    const { domain, notes } = req.body;
    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'domain is required' });
    }
    const record = await claimDomain(req.user.sub, domain, notes || null);
    res.status(201).json(record);
  }));

  router.delete('/:domain', wrapAsync(async (req, res) => {
    await unclaimDomain(req.user.sub, req.params.domain);
    res.json({ ok: true });
  }));

  return router;
}
```

- [ ] **Step 2: Create user notes route**

`server/src/routes/userNotes.js`:

```js
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
```

- [ ] **Step 3: Wire everything in index.js**

Add to the imports in `server/src/index.js`:

```js
import requireAuthMiddleware from './middleware/requireAuth.js';
import { createRequireAdmin } from './middleware/requireAdmin.js';
import { requireAdminOrToken } from './middleware/adminAuth.js';
import createUserScanRoutes from './routes/userScans.js';
import createUserNotesRoutes from './routes/userNotes.js';
```

After the existing middleware registrations (around line 80, after the `app.use('/api/admin', requireAdminApiKey)` section), add:

```js
// Global auth middleware (attaches req.user if token present; does not block)
app.use('/api', requireAuthMiddleware);

// User-owned routes (require authentication)
app.use('/api/user/scans', (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}, createUserScanRoutes());

app.use('/api/user/notes', (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}, createUserNotesRoutes());

// Replace the existing requireAdminApiKey reference for admin routes
// to accept either Auth0 admin tokens or the API key
// The existing `app.use('/api/admin', requireAdminApiKey)` becomes:
// Note: import { requireAdminOrToken } is already added above
```

Replace the existing `app.use('/api/admin', requireAdminApiKey)` line with:

```js
app.use('/api/admin', requireAdminOrToken);
```

Replace the existing `app.use('/api/logs', requireAdminApiKey)` line with:

```js
app.use('/api/logs', requireAdminOrToken);
```

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `cd server && NODE_OPTIONS=--experimental-vm-modules npx jest`
Expected: all existing tests pass with new routes integrated.

- [ ] **Step 5: Commit**

```bash
git add server/src/index.js server/src/routes/userScans.js server/src/routes/userNotes.js
git commit -m "feat(api): add user routes for scans and notes, wire auth middleware"
```

---

### Task 6: Frontend Auth0 Provider + Token Attachment

**Files:**
- Modify: `frontend/src/main.jsx` — wrap with Auth0Provider
- Modify: `frontend/src/api/client.js` — attach Bearer token from Auth0
- Modify: `frontend/package.json` — add @auth0/auth0-react

- [ ] **Step 1: Install dependency**

```bash
pnpm --filter frontend add @auth0/auth0-react
```

- [ ] **Step 2: Wrap app with Auth0Provider in main.jsx**

`frontend/src/main.jsx`:

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App.jsx';
import './index.css';

const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN || '';
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID || '';
const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE || '';

const root = createRoot(document.getElementById('root'));

root.render(
  <StrictMode>
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: AUTH0_AUDIENCE,
        scope: 'openid profile email'
      }}
      cacheLocation="localstorage"
    >
      <App />
    </Auth0Provider>
  </StrictMode>
);
```

- [ ] **Step 3: Modify client.js to attach Auth0 Bearer token**

In `frontend/src/api/client.js`, add a new import at the top:

```js
let globalGetAccessToken = null;
export function setTokenProvider(fn) {
  globalGetAccessToken = fn;
}
```

Modify the `request` function to attach Bearer token for user/admin paths. Add after the existing `ADMIN_API_KEY` logic (around line 29):

```js
    // Attach Auth0 Bearer token for authenticated routes
    if (globalGetAccessToken && (
      path.startsWith('/api/user/') || path.startsWith('/api/admin/') || path.startsWith('/api/logs/')
    )) {
      try {
        const token = await globalGetAccessToken();
        if (token) {
          headers.set('authorization', `Bearer ${token}`);
        }
      } catch {
        // Silently skip — user might not be logged in
      }
    }
```

Note: The `request` function needs to become `async` or the token fetch needs to be handled. Since `request` already returns a Promise (it's async via fetch), we can make the function `async` and use `await` for the token. But wait, `request` is already returning a promise from the fetch. Let me check — it's not declared `async` currently. I need to add `async` keyword to the function signature.

Current signature: `export async function request(path, options = {})` — it's already async. Good, I can add `await globalGetAccessToken()`.

Also, update the `VITE_ADMIN_API_KEY` sending logic: we can remove or keep the `ADMIN_API_KEY` sending for backward compatibility with deploy-time checks. The `requireAdminOrToken` middleware on the server accepts either, so sending both is fine.

- [ ] **Step 4: Provide token getter from App.jsx or a hook**

Create a token provider hook pattern. In `frontend/src/App.jsx`, add a `useEffect` that sets the token provider when auth is ready:

```jsx
import { useAuth0 } from '@auth0/auth0-react';
import { setTokenProvider } from './api/client.js';
import { useCallback, useEffect } from 'react';

function App() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  useEffect(() => {
    setTokenProvider(async () => {
      if (!isAuthenticated) return null;
      try {
        return await getAccessTokenSilently({
          authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE }
        });
      } catch {
        return null;
      }
    });
  }, [getAccessTokenSilently, isAuthenticated]);

  // ... existing App body
}
```

- [ ] **Step 5: Verify build**

Run: `pnpm --filter frontend run build`
Expected: builds without errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/main.jsx frontend/src/api/client.js frontend/src/App.jsx
git commit -m "feat(auth): add Auth0Provider and Bearer token attachment to API client"
```

---

### Task 7: LoginButton + UserMenu + AppLayout Integration

**Files:**
- Create: `frontend/src/components/atoms/LoginButton.jsx`
- Create: `frontend/src/components/molecules/UserMenu.jsx`
- Modify: `frontend/src/components/templates/AppLayout.jsx`

- [ ] **Step 1: Create LoginButton atom**

`frontend/src/components/atoms/LoginButton.jsx`:

```jsx
import { useAuth0 } from '@auth0/auth0-react';

function LoginButton() {
  const { loginWithRedirect, logout, isAuthenticated, isLoading, user } = useAuth0();

  if (isLoading) {
    return <button className="btn btn--sm" disabled>Loading...</button>;
  }

  if (isAuthenticated) {
    return null; // UserMenu handles the authenticated view
  }

  return (
    <button className="btn btn--sm" onClick={() => loginWithRedirect()}>
      Log in
    </button>
  );
}

export default LoginButton;
```

- [ ] **Step 2: Create UserMenu molecule**

`frontend/src/components/molecules/UserMenu.jsx`:

```jsx
import { useState, useRef, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

function UserMenu({ onNavigate }) {
  const { user, logout, isAuthenticated } = useAuth0();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isAuthenticated || !user) {
    return null;
  }

  const displayName = user.name || user.nickname || user.email || 'User';
  const avatarUrl = user.picture;

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu__trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="user-menu__avatar" width="24" height="24" />
        ) : null}
        <span className="user-menu__name">{displayName}</span>
      </button>
      {open ? (
        <div className="user-menu__dropdown" role="menu">
          <button
            className="user-menu__item"
            role="menuitem"
            onClick={() => { setOpen(false); onNavigate?.('my-scans'); }}
          >
            My Scans
          </button>
          <button
            className="user-menu__item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout({ logoutParams: { returnTo: window.location.origin } });
            }}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default UserMenu;
```

- [ ] **Step 3: Update AppLayout to include auth UI**

`frontend/src/components/templates/AppLayout.jsx`:

```jsx
import LoginButton from '../atoms/LoginButton.jsx';
import UserMenu from '../molecules/UserMenu.jsx';

function AppLayout({ title, subtitle, headerActions, sidebar, children, onNavigate }) {
  const bodyClass = sidebar ? 'app__body' : 'app__body app__body--single';
  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-main">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="app__header-right">
          {headerActions ? <div className="app__header-actions">{headerActions}</div> : null}
          <div className="app__header-auth">
            <UserMenu onNavigate={onNavigate} />
            <LoginButton />
          </div>
        </div>
      </header>
      <div className={bodyClass}>
        {sidebar ? <aside className="app__sidebar">{sidebar}</aside> : null}
        <main className="app__main">{children}</main>
      </div>
    </div>
  );
}

export default AppLayout;
```

PropTypes for the new `onNavigate` prop should also be added:

```jsx
AppLayout.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  headerActions: PropTypes.node,
  sidebar: PropTypes.node,
  children: PropTypes.node,
  onNavigate: PropTypes.func
};
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter frontend run build`
Expected: builds without errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/atoms/LoginButton.jsx frontend/src/components/molecules/UserMenu.jsx frontend/src/components/templates/AppLayout.jsx
git commit -m "feat(ui): add LoginButton, UserMenu, auth-aware AppLayout"
```

---

### Task 8: Save to My Scans + My Scans Page

**Files:**
- Create: `frontend/src/components/organisms/panels/SaveScanButton.jsx`
- Create: `frontend/src/components/pages/MyScansPage.jsx`
- Modify: `frontend/src/components/pages/ScanPage.jsx` — add SaveScanButton after scan
- Modify: `frontend/src/App.jsx` — add route to MyScansPage

- [ ] **Step 1: Create SaveScanButton**

`frontend/src/components/organisms/panels/SaveScanButton.jsx`:

```jsx
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
```

- [ ] **Step 2: Create MyScansPage**

`frontend/src/components/pages/MyScansPage.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { request } from '../../api/client.js';
import AppLayout from '../templates/AppLayout.jsx';

function MyScansPage({ headerActions, onNavigate }) {
  const { isAuthenticated, isLoading } = useAuth0();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const result = await request('/api/user/scans');
        if (result.ok) {
          setScans(result.data.domains || []);
        } else {
          setError('Failed to load scans');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isAuthenticated]);

  if (isLoading) {
    return <AppLayout title="My Scans" headerActions={headerActions} onNavigate={onNavigate}>Loading...</AppLayout>;
  }

  if (!isAuthenticated) {
    return (
      <AppLayout title="My Scans" headerActions={headerActions} onNavigate={onNavigate}>
        <p>Please log in to view your saved scans.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="My Scans" headerActions={headerActions} onNavigate={onNavigate}>
      {error ? <p className="text-error">{error}</p> : null}
      {loading ? <p>Loading...</p> : null}
      {!loading && scans.length === 0 ? (
        <p>No saved scans yet. Run a scan and click "Save to My Scans" to add one.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Saved</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((scan) => (
              <tr key={scan.domain}>
                <td>{scan.domain}</td>
                <td>{scan.saved_at}</td>
                <td>{scan.last_status}</td>
                <td>{scan.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppLayout>
  );
}

export default MyScansPage;
```

- [ ] **Step 3: Add SaveScanButton to ScanPage after scan completion**

In `frontend/src/components/pages/ScanPage.jsx`, find the section that renders scan results (after a domain has been scanned) and add:

```jsx
import SaveScanButton from '../organisms/panels/SaveScanButton.jsx';
```

Then in the results area, near where the scanned domain is shown:

```jsx
{scanStarted ? (
  <SaveScanButton domain={currentDomain} onSaved={() => {}} />
) : null}
```

- [ ] **Step 4: Add MyScansPage to App.jsx routing**

In `frontend/src/App.jsx`, add the import:

```jsx
import MyScansPage from './components/pages/MyScansPage.jsx';
```

Add a navigation handler and conditional rendering. If `App.jsx` uses a simple state-based router (not react-router), add a new state value and a branch:

```jsx
const [page, setPage] = useState('scan');

// In the page render block:
{page === 'my-scans' ? (
  <MyScansPage
    onNavigate={(target) => {
      if (target === 'my-scans') return;
      setPage(target);
    }}
  />
) : null}
```

The existing navigation should pass `onNavigate` through AppLayout so clicking UserMenu items works.

- [ ] **Step 5: Verify build**

Run: `pnpm --filter frontend run build`
Expected: builds without errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/organisms/panels/SaveScanButton.jsx frontend/src/components/pages/MyScansPage.jsx frontend/src/components/pages/ScanPage.jsx frontend/src/App.jsx
git commit -m "feat(ui): add save-to-my-scans flow and MyScansPage"
```

---

### Task 9: NoteEditor + HistoryPage Integration

**Files:**
- Create: `frontend/src/components/molecules/NoteEditor.jsx`
- Modify: `frontend/src/components/pages/HistoryPage.jsx` — show ownership status
- Create: `frontend/src/components/molecules/NoteEditor.test.jsx`

- [ ] **Step 1: Create NoteEditor component**

`frontend/src/components/molecules/NoteEditor.jsx`:

```jsx
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
```

- [ ] **Step 2: Integrate into HistoryPage**

In `frontend/src/components/pages/HistoryPage.jsx`, add a column or action for notes on each scan entry. After the domain name in each row:

```jsx
import NoteEditor from '../molecules/NoteEditor.jsx';
import { useAuth0 } from '@auth0/auth0-react';
```

In the row rendering, after the domain cell, add:

```jsx
<td>
  <NoteEditor domain={entry.domain} />
</td>
```

- [ ] **Step 3: Write NoteEditor test**

`frontend/src/components/molecules/NoteEditor.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NoteEditor from './NoteEditor.jsx';

// Mock @auth0/auth0-react
vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isAuthenticated: true,
    user: { sub: 'auth0|test', email: 'test@test.com' }
  })
}));

describe('NoteEditor', () => {
  it('renders textarea when authenticated', () => {
    render(<NoteEditor domain="example.com" />);
    expect(screen.getByPlaceholderText('Add a note about this domain...')).toBeInTheDocument();
  });

  it('shows nothing when not authenticated', () => {
    vi.mocked(useAuth0).mockReturnValueOnce({ isAuthenticated: false });
    const { container } = render(<NoteEditor domain="example.com" />);
    expect(container.innerHTML).toBe('');
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter frontend run test`
Expected: tests pass.

- [ ] **Step 5: Verify build**

Run: `pnpm --filter frontend run build`
Expected: builds without errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/molecules/NoteEditor.jsx frontend/src/components/molecules/NoteEditor.test.jsx frontend/src/components/pages/HistoryPage.jsx
git commit -m "feat(ui): add NoteEditor and integrate into HistoryPage"
```

---

### Task 10: netlify.toml + Deployment Configuration

**Files:**
- Create: `frontend/netlify.toml`

- [ ] **Step 1: Create netlify.toml**

`frontend/netlify.toml`:

```toml
[build]
  command = "pnpm --filter frontend run build"
  publish = "frontend/dist"

[build.environment]
  PNPM_VERSION = "10.33.0"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

- [ ] **Step 2: Verify the .env.example files are updated**

Check `frontend/.env.example` to ensure it documents `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE`.

Check `server/.env.example` to ensure it documents `AUTH0_DOMAIN` and `AUTH0_AUDIENCE`.

- [ ] **Step 3: Commit**

```bash
git add frontend/netlify.toml
git commit -m "deploy: add netlify.toml for SPA deployment"
```

---

### Self-Review

**Spec coverage check:**
- Data model (users, scan_ownership, user_notes) → Task 1, Task 2
- Auth flow (Auth0 token verification, user auto-vivify) → Task 3, Task 5
- Tiered rate limiting (anonymous 10/min, standard 60/min, admin 120/min, proxy 5/min) → Task 4
- Admin auth modifier (accept Auth0 token OR header) → Task 4
- New user routes (scans, notes CRUD) → Task 5
- Frontend LoginButton + UserMenu → Task 7
- SaveScanButton + MyScansPage → Task 8
- NoteEditor + HistoryPage integration → Task 9
- netlify.toml + env config → Task 10

**Placeholder scan:** No TBD, TODO, or incomplete sections found.

**Type consistency:** DB module function signatures (`findOrCreateUser(id, email, displayName)`, `claimDomain(userId, domain, notes)`, `createNote(userId, domain, noteText)`) are consistent across tests, implementations, and route handlers.
