const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const env = require('./config/env');
const { pool } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

// Behind a hosting proxy, trust exactly that many hops so rate limits use the visitor's IP.
app.set('trust proxy', env.trustProxy);

// Section 3.8.1: security headers, CORS for the web app's own address only, and small request bodies.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || origin === env.clientOrigin), // no Origin = same-origin or a tool like Postman
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(express.json({ limit: '100kb' }));
// A ceiling for every route; sign-in and sign-up have their own, stricter limit.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.nodeEnv === 'test' ? 100000 : 900,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Wait a few minutes and try again.' },
}));
app.use(cookieParser());
if (env.nodeEnv !== 'test') app.use(morgan('dev'));

// Uploaded report photos (re-encoded, EXIF stripped) are served read-only.
app.use('/uploads', express.static(env.uploadDir, { fallthrough: false, index: false }));

app.get('/api/health', async (req, res, next) => {
  try {
    const [[row]] = await pool.query('SELECT COUNT(*) AS attractions FROM Attractions');
    res.json({ status: 'ok', database: 'connected', attractions: row.attractions });
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/categories', require('./modules/categories/categories.routes'));
app.use('/api/users', require('./modules/users/users.routes'));
app.use('/api/attractions/:id/reviews', require('./modules/reviews/reviews.routes'));
app.use('/api/attractions', require('./modules/attractions/attractions.routes'));
app.use('/api/recommendations', require('./modules/recommendations/recommendations.routes'));
app.use('/api/admin/attractions', require('./modules/attractions/attractions.admin.routes'));
app.use('/api/admin/categories', require('./modules/categories/categories.admin.routes'));
app.use('/api/reports', require('./modules/reports/reports.routes'));
app.use('/api/admin/reports', require('./modules/reports/reports.admin.routes'));
app.use('/api/admin/analytics', require('./modules/analytics/analytics.routes'));

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
