const { pool, withTransaction } = require('../../config/db');
const { HttpError } = require('../../middleware/errors');

const firstName = (name) => (name ? name.trim().split(/\s+/)[0] : 'A visitor');

async function assertActive(conn, attractionId) {
  const [[a]] = await conn.execute("SELECT attraction_id FROM Attractions WHERE attraction_id = ? AND status = 'active'", [attractionId]);
  if (!a) throw new HttpError(404, 'This attraction does not exist or has been removed.');
}

/** Recalculates the stored average (FR-08). Runs inside the same transaction as the review change. */
async function refreshAverage(conn, attractionId) {
  await conn.execute(
    `UPDATE Attractions
        SET avg_rating = (SELECT ROUND(AVG(rating), 1) FROM Reviews WHERE attraction_id = ?)
      WHERE attraction_id = ?`,
    [attractionId, attractionId]
  );
}

/** Reviews for the details page, newest first, with a 1–5 star breakdown. Reviewers appear by first name only. */
async function list(attractionId, userId) {
  await assertActive(pool, attractionId);
  const [rows] = await pool.execute(
    `SELECT r.review_id, r.user_id, r.rating, r.comment, r.created_at, COALESCE(u.display_name, u.full_name) AS author
       FROM Reviews r JOIN Users u ON u.user_id = r.user_id
      WHERE r.attraction_id = ?
      ORDER BY r.created_at DESC, r.review_id DESC`,
    [attractionId]
  );
  const [[a]] = await pool.execute('SELECT avg_rating FROM Attractions WHERE attraction_id = ?', [attractionId]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of rows) distribution[r.rating] += 1;
  const reviews = rows.map((r) => ({
    review_id: r.review_id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    author: firstName(r.author),
    is_mine: Boolean(userId) && r.user_id === userId,
  }));
  return {
    summary: { avg_rating: a.avg_rating, count: rows.length, distribution },
    my_review: reviews.find((r) => r.is_mine) || null,
    reviews,
  };
}

/** One review per user per attraction (unique key). A second POST is refused; use PUT to change it. */
async function create(userId, attractionId, { rating, comment }) {
  await withTransaction(async (conn) => {
    await assertActive(conn, attractionId);
    try {
      await conn.execute('INSERT INTO Reviews (user_id, attraction_id, rating, comment) VALUES (?, ?, ?, ?)', [userId, attractionId, rating, comment]);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'You have already reviewed this place. Edit your review instead.');
      throw err;
    }
    await refreshAverage(conn, attractionId);
  });
  return list(attractionId, userId);
}

async function update(userId, attractionId, { rating, comment }) {
  await withTransaction(async (conn) => {
    await assertActive(conn, attractionId);
    const [result] = await conn.execute(
      'UPDATE Reviews SET rating = ?, comment = ?, created_at = UTC_TIMESTAMP() WHERE user_id = ? AND attraction_id = ?',
      [rating, comment, userId, attractionId]
    );
    if (result.affectedRows === 0) throw new HttpError(404, 'You have not reviewed this place yet.');
    await refreshAverage(conn, attractionId);
  });
  return list(attractionId, userId);
}

async function remove(userId, attractionId) {
  await withTransaction(async (conn) => {
    const [result] = await conn.execute('DELETE FROM Reviews WHERE user_id = ? AND attraction_id = ?', [userId, attractionId]);
    if (result.affectedRows === 0) throw new HttpError(404, 'You have not reviewed this place yet.');
    await refreshAverage(conn, attractionId);
  });
  return list(attractionId, userId);
}

module.exports = { list, create, update, remove };
