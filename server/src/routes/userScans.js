import { Router } from 'express';
import { wrapAsync } from '../utils/route.js';
import { claimDomain, getUserDomains, unclaimDomain, getUserRecentRuns, clearUserRecentRuns, clearUserSavedScans } from '../db/userScans.js';

export default function createUserScanRoutes() {
  const router = Router();

  router.get('/', wrapAsync(async (req, res) => {
    const domains = await getUserDomains(req.user.sub);
    res.json({ domains });
  }));

  router.get('/recent-runs', wrapAsync(async (req, res) => {
    const limit = Math.min(Number.parseInt(req.query.limit ?? '8', 10) || 8, 50);
    const runs = await getUserRecentRuns(req.user.sub, limit);
    res.json({ items: runs });
  }));

  router.delete('/recent-runs', wrapAsync(async (req, res) => {
    await clearUserRecentRuns(req.user.sub);
    res.json({ ok: true });
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

  router.delete('/', wrapAsync(async (req, res) => {
    await clearUserSavedScans(req.user.sub);
    res.json({ ok: true });
  }));

  return router;
}
