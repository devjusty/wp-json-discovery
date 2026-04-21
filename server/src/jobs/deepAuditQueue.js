import { randomUUID } from 'node:crypto';
import { execute, queryOne } from '../db/client.js';

export async function createDeepAuditJob({ domain, sitemapUrl, maxPages }) {
  const job = {
    jobId: randomUUID(),
    domain,
    sitemapUrl,
    status: 'queued',
    maxPages,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    result: null,
    createdAt: new Date().toISOString(),
  };

  await execute(
    `
      insert into deep_audit_jobs (
        job_id,
        domain,
        sitemap_url,
        status,
        max_pages,
        started_at,
        completed_at,
        error_message,
        result_json,
        created_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      job.jobId,
      job.domain,
      job.sitemapUrl,
      job.status,
      job.maxPages,
      null,
      null,
      null,
      null,
      job.createdAt,
    ],
  );

  return job;
}

export async function updateDeepAuditJobState(jobId, patch = {}) {
  const current = await getDeepAuditJob(jobId);
  if (!current) {
    return null;
  }

  const next = {
    ...current,
    ...patch,
  };

  await execute(
    `
      update deep_audit_jobs
      set
        status = ?,
        started_at = ?,
        completed_at = ?,
        error_message = ?,
        result_json = ?
      where job_id = ?
    `,
    [
      next.status,
      next.startedAt,
      next.completedAt,
      next.errorMessage,
      next.result ? JSON.stringify(next.result) : null,
      jobId,
    ],
  );

  return getDeepAuditJob(jobId);
}

export async function getDeepAuditJob(jobId) {
  const row = await queryOne(
    `
      select
        job_id,
        domain,
        sitemap_url,
        status,
        max_pages,
        started_at,
        completed_at,
        error_message,
        result_json,
        created_at
      from deep_audit_jobs
      where job_id = ?
      limit 1
    `,
    [jobId],
  );

  if (!row) {
    return null;
  }

  return mapDeepAuditJob(row);
}

function mapDeepAuditJob(row) {
  return {
    jobId: row.job_id,
    domain: row.domain,
    sitemapUrl: row.sitemap_url,
    status: row.status,
    maxPages: Number(row.max_pages ?? 0),
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    errorMessage: row.error_message ?? null,
    result: parseResult(row.result_json),
    createdAt: row.created_at,
  };
}

function parseResult(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
