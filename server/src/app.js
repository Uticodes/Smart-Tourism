const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');

const env = require('./config/env');
const { pool } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
if (env.nodeEnv !== 'test') app.use(morgan('dev'));

// Uploaded report photos (re-encoded, EXIF stripped) are served read-only.
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
app.use('/api/attractions', require('./modules/attractions/attractions.routes'));
app.use('/api/admin/attractions', require('./modules/attractions/attractions.admin.routes'));
app.use('/api/admin/categories', require('./modules/categories/categories.admin.routes'));

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
