import { Router } from 'express';

export default function createUserMeRoute() {
  const router = Router();

  router.get('/', (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { id, email, display_name, role, created_at } = req.user;
    res.json({ user: { id, email, display_name, role, created_at } });
  });

  return router;
}
