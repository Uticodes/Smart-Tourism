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
  fct: {
    minLat: Number(process.env.FCT_MIN_LAT || 8.3),
    maxLat: Number(process.env.FCT_MAX_LAT || 9.4),
    minLng: Number(process.env.FCT_MIN_LNG || 6.7),
    maxLng: Number(process.env.FCT_MAX_LNG || 7.7),
  },
};

module.exports = env;
