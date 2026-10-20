/**
 * Runs the nightly privacy job once, now.
 *   npm run privacy:truncate
 */
const env = require('../src/config/env');
const { pool } = require('../src/config/db');
const { truncateOldSearchCoordinates } = require('../src/jobs/privacy');

truncateOldSearchCoordinates()
  .then((n) => console.log(`Rounded coordinates on ${n} search log(s) older than ${env.searchLogRetentionDays} days.`))
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => pool.end());
