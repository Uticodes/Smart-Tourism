const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../../src/config/env');

const CATEGORIES = ['Historical Sites', 'Parks & Nature', 'Arts & Culture', 'Religious Sites', 'Educational Sites'];

/** Recreates every table in the TEST database and inserts the five categories. */
async function resetDb() {
  if (!env.db.database.endsWith('_test')) {
    throw new Error(`Refusing to reset "${env.db.database}": tests only run against a *_test database.`);
  }
  const conn = await mysql.createConnection({ ...env.db, multipleStatements: true });
  try {
    await conn.query(fs.readFileSync(path.join(__dirname, '../../db/schema.sql'), 'utf8'));
    for (const name of CATEGORIES) {
      await conn.execute('INSERT INTO Categories (category_name) VALUES (?)', [name]);
    }
  } finally {
    await conn.end();
  }
}

module.exports = { resetDb };
