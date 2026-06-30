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
  if (req.user?.role === 'admin') {
    return next();
  }

  return requireAdminApiKey(req, res, next);
}
