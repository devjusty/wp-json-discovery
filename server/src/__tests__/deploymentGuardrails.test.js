process.env.NODE_ENV = 'test';

import express from 'express';
import request from 'supertest';
import { deploymentGuardrails, extractDeploymentKey } from '../middleware/deploymentGuardrails.js';

function buildApp() {
  const app = express();
  app.use('/api', deploymentGuardrails);
  app.get('/api/proxy', (_req, res) => res.json({ ok: true }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  return app;
}

describe('deployment guardrails middleware', () => {
  const originalEnabled = process.env.DEPLOYMENT_GUARDRAILS_ENABLED;
  const originalKey = process.env.DEPLOYMENT_GUARDRAILS_KEY;

  function restoreDeploymentGuardrailsEnv() {
    if (originalEnabled === undefined) {
      delete process.env.DEPLOYMENT_GUARDRAILS_ENABLED;
    } else {
      process.env.DEPLOYMENT_GUARDRAILS_ENABLED = originalEnabled;
    }

    if (originalKey === undefined) {
      delete process.env.DEPLOYMENT_GUARDRAILS_KEY;
    } else {
      process.env.DEPLOYMENT_GUARDRAILS_KEY = originalKey;
    }
  }

  afterEach(restoreDeploymentGuardrailsEnv);

  it('prefers the dedicated deployment header over bearer auth', () => {
    const req = {
      headers: {
        'x-wpjd-deployment-key': 'alpha',
        authorization: 'Bearer beta',
      },
    };

    expect(extractDeploymentKey(req)).toBe('alpha');
  });

  it('blocks api requests when enabled and no key is present', async () => {
    process.env.DEPLOYMENT_GUARDRAILS_ENABLED = 'true';
    process.env.DEPLOYMENT_GUARDRAILS_KEY = 'deploy-secret';

    await request(buildApp())
      .get('/api/proxy')
      .expect(401);
  });

  it('allows api requests with the deployment header', async () => {
    process.env.DEPLOYMENT_GUARDRAILS_ENABLED = 'true';
    process.env.DEPLOYMENT_GUARDRAILS_KEY = 'deploy-secret';

    await request(buildApp())
      .get('/api/proxy')
      .set('x-wpjd-deployment-key', 'deploy-secret')
      .expect(200);
  });

  it('allows api requests with a bearer deployment token', async () => {
    process.env.DEPLOYMENT_GUARDRAILS_ENABLED = 'true';
    process.env.DEPLOYMENT_GUARDRAILS_KEY = 'deploy-secret';

    await request(buildApp())
      .get('/api/proxy')
      .set('authorization', 'Bearer deploy-secret')
      .expect(200);
  });

  it('keeps /health public when guardrails are enabled', async () => {
    process.env.DEPLOYMENT_GUARDRAILS_ENABLED = 'true';
    process.env.DEPLOYMENT_GUARDRAILS_KEY = 'deploy-secret';

    await request(buildApp())
      .get('/health')
      .expect(200);
  });
});
