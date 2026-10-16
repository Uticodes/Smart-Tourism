const { pool } = require('../../config/db');
const { HttpError } = require('../../middleware/errors');
const attractions = require('../attractions/attractions.service');
const { rank } = require('../../lib/scoring');

async function preferredCategories(userId) {
  if (!userId) return [];
  const [rows] = await pool.execute(
    `SELECT p.category_id, c.category_name FROM User_Preferences p
       JOIN Categories c ON c.category_id = p.category_id
      WHERE p.user_id = ? ORDER BY c.category_name`,
    [userId]
  );
  return rows;
}

/**
 * FR-04: ranked recommendations around a point.
 * Reuses the radius search (F4), then scores every result with lib/scoring.js.
 */
async function recommend({ userId, lat, lng, radius, limit }) {
  const prefs = await preferredCategories(userId);
  const preferredIds = new Set(prefs.map((p) => Number(p.category_id)));
  const found = await attractions.findNearby({ lat, lng, radius });
  const ranked = rank(found, preferredIds, radius);
  const searchId = await attractions.logSearch({ userId, lat, lng, categoryName: 'recommendations' });
  return {
    search_id: searchId,
    personalised: preferredIds.size > 0,
    preferences: prefs,
    radius_km: radius,
    total: ranked.length,
    attractions: ranked.slice(0, limit),
  };
}

/**
 * Records which result the user opened and at what position, for Mean Reciprocal Rank (Section 3.8.3).
 * Only the first selection per search counts, so going back and opening a second place does not overwrite it.
 */
async function recordSelection({ userId, searchId, attractionId, rank: position }) {
  const [[log]] = await pool.execute('SELECT log_id, user_id, selected_attraction_id FROM Search_Logs WHERE log_id = ?', [searchId]);
  if (!log) throw new HttpError(404, 'That search was not found.');
  if (log.user_id && log.user_id !== userId) throw new HttpError(403, 'That search belongs to another user.');
  const [[a]] = await pool.execute('SELECT attraction_id FROM Attractions WHERE attraction_id = ?', [attractionId]);
  if (!a) throw new HttpError(404, 'This attraction does not exist or has been removed.');
  const [result] = await pool.execute(
    `UPDATE Search_Logs SET selected_attraction_id = ?, selected_rank = ?
      WHERE log_id = ? AND selected_attraction_id IS NULL`,
    [attractionId, position, searchId]
  );
  return { recorded: result.affectedRows === 1 };
}

module.exports = { recommend, recordSelection, preferredCategories };
