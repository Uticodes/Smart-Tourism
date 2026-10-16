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

const bcrypt = require('bcrypt');
const request = require('supertest');

/** Creates a user directly in the test database and returns a signed-in supertest agent. */
async function signedInAgent(app, { role = 'tourist', email } = {}) {
  const { pool } = require('../../src/config/db');
  const address = email || `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const hash = await bcrypt.hash('Password@123', 4); // low cost: speed only matters in tests
  await pool.execute(
    'INSERT INTO Users (full_name, display_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [`Test ${role}`, role, address, hash, role]
  );
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: address, password: 'Password@123' }).expect(200);
  return agent;
}

module.exports.signedInAgent = signedInAgent;
