const cron = require('node-cron');
const env = require('../config/env');
const { pool } = require('../config/db');

/**
 * Section 3.8.2 (Nigeria Data Protection Act 2023): search coordinates older than the retention
 * period are rounded to 2 decimal places, about 1.1 km, so old logs can no longer place a person
 * at a building. Counts and dates stay, so analytics keep working. Safe to run more than once.
 */
async function truncateOldSearchCoordinates(days = env.searchLogRetentionDays, conn = pool) {
  const [result] = await conn.execute(
    `UPDATE Search_Logs
        SET latitude = ROUND(latitude, 2), longitude = ROUND(longitude, 2)
      WHERE searched_at < UTC_TIMESTAMP() - INTERVAL ? DAY
        AND (latitude <> ROUND(latitude, 2) OR longitude <> ROUND(longitude, 2))`,
    [days]
  );
  return result.affectedRows;
}

/** Runs every night at 02:15 Abuja time. */
function schedulePrivacyJobs() {
  return cron.schedule(
    '15 2 * * *',
    async () => {
      try {
        const n = await truncateOldSearchCoordinates();
        console.log(`[privacy] rounded coordinates on ${n} search log(s) older than ${env.searchLogRetentionDays} days`);
      } catch (err) {
        console.error('[privacy] nightly truncation failed:', err.message);
      }
    },
    { timezone: 'Africa/Lagos' }
  );
}

module.exports = { truncateOldSearchCoordinates, schedulePrivacyJobs };
