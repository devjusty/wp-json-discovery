import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  claimAnonymousInvestigation,
  createInvestigation,
  getInvestigationForUser,
  saveInvestigationSession,
} from '../db/investigations.js';
import {
  claimInvestigationRequestSchema,
  scanSessionSchema,
  startInvestigationRequestSchema,
} from '@wp-json-discovery/contracts';
import { AppError, ValidationError } from '../utils/errors.js';
import { wrapAsync } from '../utils/route.js';

function envelope(req, data) {
  return { status: 'success', requestId: req.id ?? randomUUID(), data };
}

function errorEnvelope(req, error) {
  return {
    status: 'error',
    requestId: req.id ?? randomUUID(),
    error: {
      code: error.code ?? (error.statusCode === 404 ? 'NOT_FOUND' : 'REQUEST_INVALID'),
      message: error.message,
      retryable: false,
    },
  };
}

function requireUser(req) {
  if (!req.user?.sub) throw new AppError('Authentication required', 401);
  return req.user.sub;
}

function validate(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid request');
  return result.data;
}

export default function createInvestigationRoutes() {
  const router = Router();

  router.post('/', wrapAsync(async (req, res) => {
    const userId = requireUser(req);
    const input = validate(startInvestigationRequestSchema, req.body);
    const record = await createInvestigation(userId, input);
    res.status(201).json(envelope(req, record));
  }));

  router.get('/:id', wrapAsync(async (req, res) => {
    const record = await getInvestigationForUser(requireUser(req), req.params.id);
    if (!record) throw new AppError('Investigation not found', 404);
    res.json(envelope(req, record));
  }));

  router.post('/:id/sessions/:sessionId', wrapAsync(async (req, res) => {
    const userId = requireUser(req);
    if (!req.body?.session || req.body.session.id !== req.params.sessionId) {
      throw new ValidationError('Session id does not match request');
    }
    const session = validate(scanSessionSchema, req.body.session);
    const record = await saveInvestigationSession(userId, req.params.id, session);
    if (!record) throw new AppError('Investigation not found', 404);
    res.json(envelope(req, record));
  }));

  router.post('/claim', wrapAsync(async (req, res) => {
    const userId = requireUser(req);
    const input = validate(claimInvestigationRequestSchema, req.body);
    const record = await claimAnonymousInvestigation(userId, input);
    if (!record) throw new AppError('Anonymous investigation not found', 404);
    res.json(envelope(req, record));
  }));

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.statusCode ?? 500;
    if (status >= 500) return next(error);
    return res.status(status).json(errorEnvelope(req, error));
  });

  return router;
}
