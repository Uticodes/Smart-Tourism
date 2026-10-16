const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { HttpError } = require('./errors');

const COOKIE_NAME = 'token';

/** Cookie settings for the auth token (Section 3.8.1): httpOnly, SameSite=Strict, secure in production. */
const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: env.nodeEnv === 'production',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 1 day, matches JWT_EXPIRES_IN default
};

function signToken(user) {
  return jwt.sign({ sub: user.user_id, role: user.role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

function readUser(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.jwt.secret);
    return { id: payload.sub, role: payload.role };
  } catch {
    return null; // expired or tampered token is treated as signed out
  }
}

/** Attaches req.user when a valid token is present; never blocks the request. */
function optionalAuth(req, res, next) {
  req.user = readUser(req);
  next();
}

/** Blocks the request with 401 unless a valid token is present. */
function requireAuth(req, res, next) {
  req.user = readUser(req);
  if (!req.user) return next(new HttpError(401, 'Sign in to continue.'));
  next();
}

/** Blocks the request with 403 unless the signed-in user is an administrator. */
function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role !== 'admin') return next(new HttpError(403, 'Only administrators can do this.'));
    next();
  });
}

module.exports = { COOKIE_NAME, cookieOptions, signToken, optionalAuth, requireAuth, requireAdmin };
