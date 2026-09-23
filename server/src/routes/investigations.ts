import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { investigations } from '../application/investigations.ts';
import { wrapAsync } from '../utils/route.js';

function envelope(req, data) {
  return { status: 'success', requestId: req.id ?? randomUUID(), data };
}

function errorEnvelope(req, error) {
  const code = error.code === 'validation-failed' ? 'REQUEST_INVALID'
    : error.code === 'auth-required' ? 'AUTH_REQUIRED'
      : error.code === 'not-found' ? 'NOT_FOUND'
        : error.code === 'conflict' ? 'CONFLICT'
          : error.code === 'persistence-failed' ? 'PERSISTENCE_FAILED'
            : error.code;
  return {
    status: 'error',
    requestId: req.id ?? randomUUID(),
    error: {
      code: code ?? (error.statusCode === 404 ? 'NOT_FOUND' : 'REQUEST_INVALID'),
      message: error.message,
      retryable: false,
    },
  };
}

export default function createInvestigationRoutes(application = investigations) {
  const router = Router();

  router.post('/', wrapAsync(async (req, res) => {
    const record = await application.create(req.user?.sub, req.body);
    res.status(201).json(envelope(req, record));
  }));

  router.get('/', wrapAsync(async (req, res) => {
    const records = await application.list(req.user?.sub);
    res.json(envelope(req, records));
  }));

  router.get('/:id', wrapAsync(async (req, res) => {
    const record = await application.get(req.user?.sub, req.params.id);
    res.json(envelope(req, record));
  }));

  router.post('/:id/sessions/:sessionId', wrapAsync(async (req, res) => {
    const record = await application.saveSession(req.user?.sub, req.params.id, req.params.sessionId, req.body?.session);
    res.json(envelope(req, record));
  }));

  router.post('/claim', wrapAsync(async (req, res) => {
    const record = await application.claim(req.user?.sub, req.body);
    res.json(envelope(req, record));
  }));

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.statusCode ?? 500;
    return res.status(status).json(errorEnvelope(req, error));
  });

  return router;
}
