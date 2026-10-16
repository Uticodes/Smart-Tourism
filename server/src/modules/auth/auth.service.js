const bcrypt = require('bcrypt');
const { pool } = require('../../config/db');
const { HttpError } = require('../../middleware/errors');

const BCRYPT_ROUNDS = 12;

/** Shape returned to the client: never includes the password hash. */
async function publicUser(userId) {
  const [[user]] = await pool.execute(
    `SELECT u.user_id, u.full_name, u.display_name, u.email, u.role, u.created_at,
            (SELECT COUNT(*) FROM User_Preferences p WHERE p.user_id = u.user_id) AS preference_count
       FROM Users u WHERE u.user_id = ?`,
    [userId]
  );
  return user || null;
}

async function register({ full_name, display_name, email, password }) {
  const [existing] = await pool.execute('SELECT user_id FROM Users WHERE email = ?', [email]);
  if (existing.length) throw new HttpError(409, 'An account with this email already exists. Sign in instead.');

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const name = display_name || full_name.split(/\s+/)[0];
  const [result] = await pool.execute(
    'INSERT INTO Users (full_name, display_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [full_name, name, email, hash, 'tourist']
  );
  return publicUser(result.insertId);
}

async function login({ email, password }) {
  const [[row]] = await pool.execute('SELECT user_id, role, password_hash FROM Users WHERE email = ?', [email]);
  // Same message whether the email or the password is wrong, so accounts cannot be discovered.
  const ok = row && (await bcrypt.compare(password, row.password_hash));
  if (!ok) throw new HttpError(401, 'Email or password is incorrect.');
  return { user: await publicUser(row.user_id), role: row.role };
}

module.exports = { register, login, publicUser, BCRYPT_ROUNDS };
