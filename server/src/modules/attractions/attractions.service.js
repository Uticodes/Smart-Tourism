const { pool } = require('../../config/db');
const { HttpError } = require('../../middleware/errors');
const { insideFCT, boundingBox, withinRadius } = require('../../lib/geo');
const { directionsUrl } = require('../../lib/directions');
const { publicName } = require('../../lib/names');
const { withAttractionPhoto } = require('../../lib/attractionPhotos');

const SELECT_COLUMNS = `
  a.attraction_id, a.name, a.category_id, c.category_name, a.description,
  a.latitude, a.longitude, a.address, a.avg_rating, a.image_url, a.source, a.status, a.created_at,
  (SELECT COUNT(*) FROM Reviews r WHERE r.attraction_id = a.attraction_id) AS review_count`;

/**
 * Location-based search (FR-03, Section 3.7.2).
 * Step 1: SQL keeps only rows inside the bounding box of the search circle (uses the lat/lng index).
 * Step 2: the Haversine formula removes the box corners and gives exact distances.
 */
async function findNearby({ lat, lng, radius, minRating = 0, category }) {
  const box = boundingBox(lat, lng, radius);
  const params = [box.minLat, box.maxLat, box.minLng, box.maxLng];
  let sql = `SELECT ${SELECT_COLUMNS}
               FROM Attractions a JOIN Categories c ON c.category_id = a.category_id
              WHERE a.status = 'active'
                AND a.latitude BETWEEN ? AND ? AND a.longitude BETWEEN ? AND ?`;
  if (minRating > 0) {
    sql += ' AND a.avg_rating >= ?';
    params.push(minRating);
  }
  if (category) {
    sql += ' AND a.category_id = ?';
    params.push(category);
  }
  const [rows] = await pool.execute(sql, params);
  return withinRadius(rows, lat, lng, radius).map((r) => withAttractionPhoto({ ...r, distance_km: Number(r.distance_km.toFixed(2)) }));
}

/** One row per search, for the analytics dashboard and the MRR evaluation (Search_Logs). */
async function logSearch({ userId, lat, lng, categoryName }) {
  const [result] = await pool.execute(
    'INSERT INTO Search_Logs (user_id, query_text, latitude, longitude) VALUES (?, ?, ?, ?)',
    [userId || null, categoryName || null, lat, lng]
  );
  return result.insertId;
}

async function getById(id, { includeInactive = false } = {}) {
  const [[row]] = await pool.execute(
    `SELECT ${SELECT_COLUMNS} FROM Attractions a JOIN Categories c ON c.category_id = a.category_id
      WHERE a.attraction_id = ? ${includeInactive ? '' : "AND a.status = 'active'"}`,
    [id]
  );
  if (!row) throw new HttpError(404, 'This attraction does not exist or has been removed.');
  return withAttractionPhoto(row);
}

/**
 * Public details page (FR-06, FR-07): everything getById returns, plus the photo list,
 * the Google Maps directions link and, for community-discovered sites, who reported it and when it was approved.
 */
async function getDetails(id) {
  const a = await getById(id);
  let photos = a.image_url ? [a.image_url] : [];
  let community = null;
  if (a.source === 'community') {
    const [[r]] = await pool.execute(
      `SELECT r.local_name, r.access_notes, r.photo_urls, r.reviewed_at, u.display_name, u.full_name
         FROM Attractions a JOIN Site_Reports r ON r.report_id = a.report_id
         LEFT JOIN Users u ON u.user_id = r.reporter_id
        WHERE a.attraction_id = ?`,
      [id]
    );
    if (r) {
      const reportPhotos = typeof r.photo_urls === 'string' ? JSON.parse(r.photo_urls) : r.photo_urls || [];
      photos = [...new Set([...photos, ...reportPhotos])];
      community = {
        contributor: publicName(r.display_name, r.full_name), // display name only (Section 3.8.2)
        verified_at: r.reviewed_at,
        local_name: r.local_name,
        access_notes: r.access_notes,
      };
    }
  }
  return { ...a, photos, community, directions_url: directionsUrl(a.latitude, a.longitude) };
}

async function listForAdmin({ q, status, category }) {
  const where = [];
  const params = [];
  if (q) {
    where.push('(a.name LIKE ? OR a.address LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (status !== 'all') {
    where.push('a.status = ?');
    params.push(status);
  }
  if (category) {
    where.push('a.category_id = ?');
    params.push(category);
  }
  const [rows] = await pool.execute(
    `SELECT ${SELECT_COLUMNS} FROM Attractions a JOIN Categories c ON c.category_id = a.category_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY a.name`,
    params
  );
  return rows.map(withAttractionPhoto);
}

async function assertValid(data) {
  if (!insideFCT(data.latitude, data.longitude)) {
    throw new HttpError(400, 'The location must be inside the Federal Capital Territory.', [
      { path: ['latitude'], message: 'Pick a point inside the FCT.' },
    ]);
  }
  const [[cat]] = await pool.execute('SELECT category_id FROM Categories WHERE category_id = ?', [data.category_id]);
  if (!cat) throw new HttpError(400, 'Choose a category.', [{ path: ['category_id'], message: 'Choose a category.' }]);
}

async function create(data) {
  await assertValid(data);
  const [result] = await pool.execute(
    `INSERT INTO Attractions (name, category_id, description, latitude, longitude, address, image_url, source, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'curated', ?)`,
    [data.name, data.category_id, data.description, data.latitude, data.longitude, data.address, data.image_url, data.status]
  );
  return getById(result.insertId, { includeInactive: true });
}

async function update(id, data) {
  await getById(id, { includeInactive: true });
  await assertValid(data);
  await pool.execute(
    `UPDATE Attractions SET name = ?, category_id = ?, description = ?, latitude = ?, longitude = ?,
            address = ?, image_url = ?, status = ? WHERE attraction_id = ?`,
    [data.name, data.category_id, data.description, data.latitude, data.longitude, data.address, data.image_url, data.status, id]
  );
  return getById(id, { includeInactive: true });
}

/** Soft delete: the row stays (reviews and reports still point to it) but disappears from search. */
async function deactivate(id) {
  await getById(id, { includeInactive: true });
  await pool.execute("UPDATE Attractions SET status = 'inactive' WHERE attraction_id = ?", [id]);
  return getById(id, { includeInactive: true });
}

module.exports = { findNearby, logSearch, getById, getDetails, listForAdmin, create, update, deactivate };
