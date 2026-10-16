const express = require('express');
const rateLimit = require('express-rate-limit');
const env = require('../../config/env');
const { validate } = require('../../middleware/validate');
const { COOKIE_NAME, cookieOptions, signToken, requireAuth } = require('../../middleware/auth');
const { HttpError } = require('../../middleware/errors');
const { registerSchema, loginSchema } = require('./auth.schemas');
const service = require('./auth.service');

const router = express.Router();

// Slows down password guessing: 10 attempts per 15 minutes per address.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.nodeEnv === 'test' ? 1000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait 15 minutes and try again.' },
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const user = await service.register(req.body);
    res.cookie(COOKIE_NAME, signToken(user), cookieOptions);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { user } = await service.login(req.body);
    res.cookie(COOKIE_NAME, signToken(user), cookieOptions);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  const { maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie(COOKIE_NAME, clearOptions);
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await service.publicUser(req.user.id);
    if (!user) throw new HttpError(401, 'Sign in to continue.');
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
