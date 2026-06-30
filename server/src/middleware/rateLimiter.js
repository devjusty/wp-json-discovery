import rateLimit from 'express-rate-limit';

export function getRateLimitConfig(req) {
  if (!req.user) {
    return { points: 10, duration: 60, message: 'Too many requests. Anonymous limit: 10 per minute.' };
  }
  if (req.user.role === 'admin') {
    return { points: 120, duration: 60, message: 'Too many requests. Admin limit: 120 per minute.' };
  }
  if (req.path.startsWith('/api/proxy')) {
    return { points: 5, duration: 60, message: 'Too many proxy requests. Limit: 5 per minute.' };
  }
  return { points: 60, duration: 60, message: 'Too many requests. Standard limit: 60 per minute.' };
}

export function rateLimitKey(req) {
  if (req.user?.sub) {
    return `user:${req.user.sub}`;
  }
  const ip = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || 'unknown';
  return `ip:${ip}`;
}

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  message: 'Too many requests, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  skip: (req) => false,
});
