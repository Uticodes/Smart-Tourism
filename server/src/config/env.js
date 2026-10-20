const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  db: {
    host: required('DB_HOST', '127.0.0.1'),
    port: Number(process.env.DB_PORT || 3306),
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    database: required('DB_NAME'),
  },
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  // Where re-encoded report photos are saved; served read-only at /uploads.
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
  // Section 3.8.2: full search coordinates are kept this many days, then cut to 2 decimal places (~1.1 km).
  searchLogRetentionDays: Number(process.env.SEARCH_LOG_RETENTION_DAYS || 30),
  // FR-15: site reports per user per 24 hours. Only the isolated performance test raises it.
  reportDailyLimit: Number(process.env.REPORT_DAILY_LIMIT || 5),
  // Where duplicate warnings are logged (see src/lib/eventLog.js).
  eventLogDir: process.env.EVENT_LOG_DIR || path.join(__dirname, '../../logs'),
  // Set to 1 when deployed behind one reverse proxy (Render, Railway, Nginx) so rate limits see the real client IP.
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 0,
  fct: {
    minLat: Number(process.env.FCT_MIN_LAT || 8.3),
    maxLat: Number(process.env.FCT_MAX_LAT || 9.4),
    minLng: Number(process.env.FCT_MIN_LNG || 6.7),
    maxLng: Number(process.env.FCT_MAX_LNG || 7.7),
  },
};

// Refuse to start in production with settings that are only safe on a laptop.
if (env.nodeEnv === 'production') {
  if (env.jwt.secret.length < 32 || /change|secret|example/i.test(env.jwt.secret)) {
    throw new Error('JWT_SECRET must be a random value of at least 32 characters in production.');
  }
  if (!/^https:\/\//.test(env.clientOrigin)) {
    throw new Error('CLIENT_ORIGIN must be the https:// address of the web app in production.');
  }
}

module.exports = env;
