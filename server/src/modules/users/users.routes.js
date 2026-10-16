const express = require('express');
const { z } = require('zod');
const { pool, withTransaction } = require('../../config/db');
const { requireAuth } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { HttpError } = require('../../middleware/errors');

const router = express.Router();

const preferencesSchema = z.object({
  category_ids: z.array(z.number().int().positive()).max(20).transform((ids) => [...new Set(ids)]),
});

async function listPreferences(userId) {
  const [rows] = await pool.execute(
    `SELECT c.category_id, c.category_name
       FROM User_Preferences p JOIN Categories c ON c.category_id = p.category_id
      WHERE p.user_id = ? ORDER BY c.category_name`,
    [userId]
  );
  return rows;
}

router.get('/me/preferences', requireAuth, async (req, res, next) => {
  try {
    res.json({ preferences: await listPreferences(req.user.id) });
  } catch (err) {
    next(err);
  }
});

// Replaces the full set of preferred categories (FR-02).
router.put('/me/preferences', requireAuth, validate(preferencesSchema), async (req, res, next) => {
  const ids = req.body.category_ids;
  try {
    if (ids.length) {
      const [found] = await pool.query('SELECT category_id FROM Categories WHERE category_id IN (?)', [ids]);
      if (found.length !== ids.length) throw new HttpError(400, 'One or more categories do not exist.');
    }
    await withTransaction(async (conn) => {
      await conn.execute('DELETE FROM User_Preferences WHERE user_id = ?', [req.user.id]);
      for (const id of ids) {
        await conn.execute('INSERT INTO User_Preferences (user_id, category_id) VALUES (?, ?)', [req.user.id, id]);
      }
    });
    res.json({ preferences: await listPreferences(req.user.id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
