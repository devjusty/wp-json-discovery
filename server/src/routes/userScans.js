import { Router } from 'express';
import { wrapAsync } from '../utils/route.js';
import { claimDomain, getUserDomains, unclaimDomain } from '../db/userScans.js';

export default function createUserScanRoutes() {
  const router = Router();

  router.get('/', wrapAsync(async (req, res) => {
    const domains = await getUserDomains(req.user.sub);
    res.json({ domains });
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

  return router;
}
