import { timingSafeEqual } from 'node:crypto';

function asSingleHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return typeof value === 'string' ? value : '';
}

function isEnabled(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function safeCompare(expected, actual) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function extractDeploymentKey(req) {
  const direct = asSingleHeaderValue(req.headers['x-wpjd-deployment-key']);
  if (direct) {
    return direct;
  }

  const authorization = asSingleHeaderValue(req.headers.authorization);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
}

export function deploymentGuardrails(req, res, next) {
  if (!isEnabled(process.env.DEPLOYMENT_GUARDRAILS_ENABLED)) {
    return next();
  }

  const configuredKey = asSingleHeaderValue(process.env.DEPLOYMENT_GUARDRAILS_KEY);
  const providedKey = extractDeploymentKey(req);

  if (!configuredKey || !providedKey || !safeCompare(configuredKey, providedKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

export default deploymentGuardrails;
