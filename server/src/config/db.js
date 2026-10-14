const mysql = require('mysql2/promise');
const env = require('./env');

// One shared connection pool. All queries go through pool.execute()
// with ? placeholders (prepared statements), never string-built SQL.
const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  timezone: 'Z',
});

/** Run fn(connection) inside a transaction; commits on success, rolls back on error. */
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, withTransaction };
