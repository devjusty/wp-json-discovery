import {
  claimInvestigationRequestSchema,
  scanSessionSchema,
  startInvestigationRequestSchema,
} from '@wp-json-discovery/contracts';
import {
  investigationRepository,
} from '../db/investigations.ts';
import { AppError } from '../utils/errors.js';
import { sanitizeDomain } from '../utils/domain.js';

export class InvestigationApplicationError extends AppError {
  constructor(code, message, statusCode, details = null) {
    super(message, statusCode, details);
    Object.assign(this, { code });
    this.name = 'InvestigationApplicationError';
  }
}

/** @type {any} */
const defaultRepository = investigationRepository;

function authorize(userId) {
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new InvestigationApplicationError('auth-required', 'Authentication required', 401);
  }
  return userId;
}

function validate(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new InvestigationApplicationError(
      'validation-failed',
      result.error.issues[0]?.message ?? 'Invalid request',
      400,
      result.error.issues,
    );
  }
  return result.data;
}

function canonicalizeDomain(input, requireMatchingNormalized = false) {
  const normalized = sanitizeDomain(input.domain.submitted);
  if (!normalized) throw new InvestigationApplicationError('validation-failed', 'Domain is unsafe or malformed', 400);
  if (requireMatchingNormalized && input.domain.normalized !== normalized) {
    throw new InvestigationApplicationError('validation-failed', 'Domain normalized identity does not match submitted domain', 400);
  }
  return { submitted: input.domain.submitted, normalized };
}

function mapRepositoryError(cause) {
  if (cause instanceof InvestigationApplicationError) return cause;
  if (cause instanceof AppError && cause.statusCode < 500) {
    return new InvestigationApplicationError(
      cause.statusCode === 404 ? 'not-found' : 'validation-failed',
      cause.message,
      cause.statusCode,
      cause.details,
    );
  }
  if (cause?.statusCode === 404) return new InvestigationApplicationError('not-found', cause.message, 404);
  if (cause?.code === 'SQLITE_CONSTRAINT' || /unique constraint|conflict/i.test(cause?.message ?? '')) {
    return new InvestigationApplicationError('conflict', 'Investigation conflicts with an existing record.', 409);
  }
  return new InvestigationApplicationError('persistence-failed', 'Investigation persistence failed.', 500, cause);
}

async function call(repository, operation, ...args) {
  try {
    if (typeof repository[operation] !== 'function') {
      throw new Error(`Repository operation is unavailable: ${operation}`);
    }
    return await repository[operation](...args);
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export function createInvestigationApplication(...args) {
  const repository = args[0] ?? defaultRepository;
  return {
    async create(userId, request) {
      const ownerId = authorize(userId);
      const input = validate(startInvestigationRequestSchema, request);
      return call(repository, 'create', ownerId, { ...input, domain: canonicalizeDomain(input) });
    },
    async list(userId) {
      return call(repository, 'list', authorize(userId));
    },
    async get(userId, investigationId) {
      const record = await call(repository, 'get', authorize(userId), investigationId);
      if (!record) throw new InvestigationApplicationError('not-found', 'Investigation not found', 404);
      return record;
    },
    async saveSession(userId, investigationId, expectedSessionId, value) {
      const ownerId = authorize(userId);
      if (!value || value.id !== expectedSessionId) {
        throw new InvestigationApplicationError('validation-failed', 'Session id does not match request', 400);
      }
      const session = validate(scanSessionSchema, value);
      if (session.investigationId !== investigationId) {
        throw new InvestigationApplicationError('validation-failed', 'Session investigationId does not match route investigation', 400);
      }
      const record = await call(repository, 'saveSession', ownerId, investigationId, session);
      if (!record) throw new InvestigationApplicationError('not-found', 'Investigation not found', 404);
      return record;
    },
    async claim(userId, request) {
      const ownerId = authorize(userId);
      const input = validate(claimInvestigationRequestSchema, request);
      const record = await call(repository, 'claim', ownerId, {
        ...input,
        domain: canonicalizeDomain(input, true),
      });
      if (!record) throw new InvestigationApplicationError('not-found', 'Anonymous investigation not found.', 404);
      return record;
    },
  };
}

export const investigations = createInvestigationApplication();
