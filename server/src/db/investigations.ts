import { randomUUID } from 'node:crypto';
import {
  claimInvestigationRequestSchema,
  investigationListSchema,
  investigationRecordSchema,
  scanSessionSchema,
  sessionRecordSchema,
  startInvestigationRequestSchema,
} from '@wp-json-discovery/contracts';
import { executeBatch, executeTransaction, queryAll, queryOne } from './client.js';

function parse(schema, value) {
  return schema.parse(value);
}

function investigationRecord(row, sessionIds, latestSession) {
  const record = {
    recordType: 'investigation',
    investigation: {
      id: row.id,
      ownerId: row.owner_id,
      domain: { submitted: row.submitted_domain, normalized: row.normalized_domain },
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sessionIds,
  };
  if (latestSession) {
    // @ts-expect-error -- optional schema field is added only when a latest session exists
    record.latestSession = latestSession;
  }
  return parse(investigationRecordSchema, record);
}

function investigationSummary(row) {
  const summary = {
    id: row.id,
    domain: { submitted: row.submitted_domain, normalized: row.normalized_domain },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    selectedCapabilityCount: 0,
    completedCapabilityCount: 0,
    findingsCount: 0,
  };

  if (row.snapshot_json) {
    const session = parse(scanSessionSchema, JSON.parse(row.snapshot_json));
    // @ts-expect-error -- scanSessionSchema validates session.id as a string
    summary.latestSessionId = session.id;
    summary.selectedCapabilityCount = session.selectedCapabilities.length;
    const capabilityStates = Object.values(session.capabilityStates);
    for (const state of capabilityStates) {
      // @ts-expect-error -- scanSessionSchema validates capability state records
      if (state.status !== 'success') continue;
      summary.completedCapabilityCount += 1;
      // @ts-expect-error -- scanSessionSchema validates capability state records
      if (state.outcome.result && typeof state.outcome.result === 'object'
        // @ts-expect-error -- scanSessionSchema validates capability result records
        && Array.isArray(state.outcome.result.findings)) {
        // @ts-expect-error -- scanSessionSchema validates capability result records
        summary.findingsCount += state.outcome.result.findings.length;
      }
    }
  }

  return summary;
}

async function readInvestigation(id, ownerId) {
  const row = await queryOne(
    `select id, owner_id, submitted_domain, normalized_domain, created_at, updated_at
     from investigations where id = ? and owner_id = ?`,
    [id, ownerId]
  );
  if (!row) return null;

  const sessions = await queryAll(
     `select session_id, id, sequence, snapshot_json, persisted_at
      from investigation_sessions where investigation_id = ? order by sequence asc`,
    [id]
  );
  const latest = sessions.at(-1);
  return investigationRecord(
    row,
    sessions.map((session) => session.session_id ?? session.id),
    latest ? parse(scanSessionSchema, JSON.parse(latest.snapshot_json)) : null
  );
}

function sessionRecord(session, persistedAt) {
  return parse(sessionRecordSchema, { recordType: 'session', session, persistedAt });
}

export async function createInvestigation(ownerId, request) {
  if (typeof ownerId !== 'string' || ownerId.length === 0) {
    throw new Error('Authenticated owner is required');
  }
  const input = parse(startInvestigationRequestSchema, request);
  const id = randomUUID();
  const sessionId = randomUUID();
  const now = new Date().toISOString();
  const initialSession = parse(scanSessionSchema, {
    id: sessionId,
    investigationId: id,
    status: 'idle',
    startedAt: null,
    completedAt: null,
    selectedCapabilities: input.selectedCapabilities,
    capabilityStates: Object.fromEntries(input.selectedCapabilities.map(({ id: capabilityId }) => [
      capabilityId,
      { status: 'idle', retry: { status: 'not-retryable' } },
    ])),
    overall: { status: 'incomplete' },
  });

  await executeBatch([
    {
      sql: `insert into investigations
        (id, owner_id, submitted_domain, normalized_domain, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
      args: [id, ownerId, input.domain.submitted, input.domain.normalized, now, now],
    },
    {
      sql: `insert into investigation_sessions
        (id, investigation_id, session_id, sequence, snapshot_json, persisted_at)
       values (?, ?, ?, 1, ?, ?)`,
      args: [randomUUID(), id, sessionId, JSON.stringify(initialSession), now],
    },
  ]);

  return readInvestigation(id, ownerId);
}

export async function saveInvestigationSession(ownerId, investigationId, snapshot) {
  const session = parse(scanSessionSchema, snapshot);
  if (session.investigationId !== investigationId) {
    throw new Error('Session investigationId does not match route investigation');
  }

  const investigation = await queryOne(
    'select id from investigations where id = ? and owner_id = ?',
    [investigationId, ownerId]
  );
  if (!investigation) return null;

  const persistedAt = new Date().toISOString();
  await executeTransaction(async (transaction) => {
    await transaction.execute({
      sql: `insert into investigation_sessions
        (id, investigation_id, session_id, sequence, snapshot_json, persisted_at)
       values (?, ?, ?, (select coalesce(max(sequence), 0) + 1 from investigation_sessions where investigation_id = ?), ?, ?)`,
      args: [randomUUID(), investigationId, session.id, investigationId, JSON.stringify(session), persistedAt],
    });
    await transaction.execute({
      sql: 'update investigations set updated_at = ? where id = ? and owner_id = ?',
      args: [persistedAt, investigationId, ownerId],
    });
  });
  return sessionRecord(session, persistedAt);
}

export async function getInvestigationForUser(userId, investigationId) {
  return readInvestigation(investigationId, userId);
}

export async function listInvestigationsForUser(ownerId) {
  const rows = await queryAll(
    `select i.id, i.submitted_domain, i.normalized_domain, i.created_at, i.updated_at,
            s.session_id, s.id as session_row_id, s.snapshot_json
     from investigations i
     left join investigation_sessions s
       on s.investigation_id = i.id
      and s.sequence = (
        select max(latest.sequence)
        from investigation_sessions latest
        where latest.investigation_id = i.id
      )
     where i.owner_id = ?
     order by i.updated_at desc, i.id desc`,
    [ownerId]
  );

  return parse(investigationListSchema, {
    investigations: rows.map(investigationSummary),
  });
}

export async function claimAnonymousInvestigation(userId, anonymousRecord) {
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('Authenticated owner is required');
  }
  const input = parse(claimInvestigationRequestSchema, anonymousRecord);
  const sourceSession = parse(sessionRecordSchema, input.anonymousRecord);
  const investigationId = randomUUID();
  const importedSession = parse(scanSessionSchema, {
    ...sourceSession.session,
    investigationId,
    ...(sourceSession.session.investigationState
      ? { investigationState: { ...sourceSession.session.investigationState, id: investigationId } }
      : {}),
  });
  const now = new Date().toISOString();

  const canonicalInvestigationId = await executeTransaction(async (transaction) => {
    await transaction.execute({
      sql: `insert into investigations
        (id, owner_id, submitted_domain, normalized_domain, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
      args: [investigationId, userId, input.domain.submitted, input.domain.normalized, now, now],
    });

    const claimResult = await transaction.execute({
      sql: `insert into investigation_claims
        (session_id, investigation_id, owner_id, claimed_at)
       values (?, ?, ?, ?)
       on conflict(session_id) do nothing`,
      args: [importedSession.id, investigationId, userId, now],
    });

    if (Number(claimResult.rowsAffected ?? 0) === 1) {
      await transaction.execute({
        sql: `insert into investigation_sessions
          (id, investigation_id, session_id, sequence, snapshot_json, persisted_at)
         values (?, ?, ?, 1, ?, ?)`,
        args: [randomUUID(), investigationId, importedSession.id, JSON.stringify(importedSession), now],
      });
      return investigationId;
    }

    const existingClaim = await transaction.execute({
      sql: 'select investigation_id, owner_id from investigation_claims where session_id = ?',
      args: [importedSession.id],
    });
    await transaction.execute({
      sql: 'delete from investigations where id = ?',
      args: [investigationId],
    });

    const canonicalClaim = existingClaim.rows?.[0];
    return canonicalClaim?.owner_id === userId ? canonicalClaim.investigation_id : null;
  });

  return canonicalInvestigationId ? readInvestigation(canonicalInvestigationId, userId) : null;
}
