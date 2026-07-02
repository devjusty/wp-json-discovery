process.env.NODE_ENV = 'test';

import { describe, it, expect } from '@jest/globals';
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
    jwksUri: null,
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
    expect(req.user.id).toBe('auth0|valid');
    expect(req.user.sub).toBe('auth0|valid');
    expect(req.user.email).toBe('valid@test.com');
    expect(req.user.role).toBe('standard');
  });

  it('sets req.user to null for missing token', async () => {
    const req = buildReq({});
    const res = buildRes();
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(req.user).toBeNull();
  });

  it('sets req.user to null for invalid token', async () => {
    const req = buildReq({ authorization: 'Bearer invalidtoken' });
    const res = buildRes();
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(req.user).toBeNull();
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
