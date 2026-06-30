import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { findOrCreateUser } from '../db/users.js';

function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function createRequireAuth(options = {}) {
  const {
    jwksUri = `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
    audience = process.env.AUTH0_AUDIENCE,
    issuer = `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms = ['RS256']
  } = options;

  let getKey;

  if (options.secretOrKey) {
    getKey = (header, callback) => {
      callback(null, options.secretOrKey);
    };
  } else {
    const client = jwksClient({ jwksUri });
    getKey = (header, callback) => {
      client.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        callback(null, key.getPublicKey());
      });
    };
  }

  return async function requireAuth(req, res, next) {
    const token = extractBearerToken(req);
    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = await new Promise((resolve, reject) => {
        jwt.verify(token, getKey, { audience, issuer, algorithms }, (err, decoded) => {
          if (err) return reject(err);
          resolve(decoded);
        });
      });

      const sub = decoded.sub || '';
      const email = decoded.email || '';
      const displayName = decoded.name || decoded.nickname || email;
      const role = decoded['https://wp-json-discovery/roles'] || 'standard';

      const user = await findOrCreateUser(sub, email, displayName, role);
      req.user = { ...user };

      next();
    } catch (err) {
      req.user = null;
      next();
    }
  };
}

export default createRequireAuth();
