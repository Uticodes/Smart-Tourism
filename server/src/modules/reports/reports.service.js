const { pool, withTransaction } = require('../../config/db');
const { HttpError } = require('../../middleware/errors');
const { insideFCT, boundingBox, nearestWithin, withinRadius } = require('../../lib/geo');
const { afterResponse, canAdminDecide, COMMUNITY_CAN_RESPOND, ADMIN_ACTIONS, OPEN } = require('../../lib/reportStatus');

const DUPLICATE_METRES = 150;   // FR-12: anything closer may be the same place
const NEAREST_CONTEXT_M = 1000; // nearest place recorded for the admin, even if not a duplicate
const DAILY_LIMIT = 5;          // FR-15: reports per user per 24 hours

const parsePhotos = (v) => (typeof v === 'string' ? JSON.parse(v) : v || []);
const firstName = (name) => (name ? name.trim().split(/\s+/)[0] : null);

/* ------------------------------------------------------------------ F7: submit */

/** Checks done before any photo is saved: daily limit, FCT boundary, then duplicates. */
async function preflight(userId, data) {
  const [[{ n }]] = await pool.execute(
    'SELECT COUNT(*) AS n FROM Site_Reports WHERE reporter_id = ? AND submitted_at >= (UTC_TIMESTAMP() - INTERVAL 1 DAY)',
    [userId]
  );
  if (n >= DAILY_LIMIT) {
    throw new HttpError(429, `You can send ${DAILY_LIMIT} reports a day. Try again tomorrow.`, undefined, { code: 'DAILY_LIMIT' });
  }

  if (!insideFCT(data.latitude, data.longitude)) {
    throw new HttpError(400, 'This location is outside the Federal Capital Territory. Only places in the FCT can be reported.',
      [{ path: ['latitude'], message: 'Choose a point inside the FCT.' }], { code: 'OUTSIDE_FCT' });
  }

  const [[cat]] = await pool.execute('SELECT category_id FROM Categories WHERE category_id = ?', [data.category_id]);
  if (!cat) throw new HttpError(400, 'Choose a category.', [{ path: ['category_id'], message: 'Choose a category.' }]);

  const nearest = await findNearest(data.latitude, data.longitude, NEAREST_CONTEXT_M);
  if (nearest && nearest.distance_m <= DUPLICATE_METRES && !data.different_place) {
    throw new HttpError(409, `“${nearest.name}” is ${Math.round(nearest.distance_m)} m from this point. Is it the same place?`, undefined, {
      code: 'DUPLICATE',
      nearby: nearest,
    });
  }
  return nearest;
}

/** Nearest active attraction or open, visible report within `metres` of a point. */
async function findNearest(lat, lng, metres) {
  const box = boundingBox(lat, lng, metres / 1000);
  const boxArgs = [box.minLat, box.maxLat, box.minLng, box.maxLng];
  const [attractions] = await pool.execute(
    `SELECT a.attraction_id AS id, a.name, a.latitude, a.longitude, a.source, c.category_name
       FROM Attractions a JOIN Categories c ON c.category_id = a.category_id
      WHERE a.status = 'active' AND a.latitude BETWEEN ? AND ? AND a.longitude BETWEEN ? AND ?`,
    boxArgs
  );
  const [reports] = await pool.execute(
    `SELECT r.report_id AS id, r.site_name AS name, r.latitude, r.longitude, c.category_name
       FROM Site_Reports r JOIN Categories c ON c.category_id = r.category_id
      WHERE r.status IN ('pending','under_review','needs_info') AND r.is_hidden = FALSE
        AND r.latitude BETWEEN ? AND ? AND r.longitude BETWEEN ? AND ?`,
    boxArgs
  );
  const candidates = [
    ...attractions.map((a) => ({ ...a, kind: 'attraction' })),
    ...reports.map((r) => ({ ...r, kind: 'report' })),
  ];
  const hit = nearestWithin(candidates, lat, lng, metres);
  if (!hit) return null;
  const { row } = hit;
  return {
    kind: row.kind,
    id: row.id,
    name: row.name,
    category_name: row.category_name,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    distance_m: hit.distance_m,
  };
}

async function create(userId, data, photoUrls) {
  const nearest = data._nearest;
  const [result] = await pool.execute(
    `INSERT INTO Site_Reports (reporter_id, category_id, site_name, local_name, description, latitude, longitude,
                               access_notes, photo_urls, public_access, status,
                               nearest_attraction_id, nearest_report_id, nearest_distance_m)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [
      userId, data.category_id, data.site_name, data.local_name, data.description, data.latitude, data.longitude,
      data.access_notes, JSON.stringify(photoUrls), true,
      nearest?.kind === 'attraction' ? nearest.id : null,
      nearest?.kind === 'report' ? nearest.id : null,
      nearest ? nearest.distance_m : null,
    ]
  );
  return getOwn(userId, result.insertId);
}

const OWN_COLUMNS = `
  r.report_id, r.site_name, r.local_name, r.category_id, c.category_name, r.description, r.access_notes,
  r.latitude, r.longitude, r.photo_urls, r.status, r.confirm_count, r.flag_count, r.is_hidden,
  r.review_note, r.submitted_at, r.reviewed_at,
  (SELECT a.attraction_id FROM Attractions a WHERE a.report_id = r.report_id LIMIT 1) AS attraction_id`;

const shapeOwn = (r) => ({ ...r, photo_urls: parsePhotos(r.photo_urls), is_hidden: Boolean(r.is_hidden) });

async function getOwn(userId, reportId) {
  const [[row]] = await pool.execute(
    `SELECT ${OWN_COLUMNS} FROM Site_Reports r JOIN Categories c ON c.category_id = r.category_id
      WHERE r.report_id = ? AND r.reporter_id = ?`,
    [reportId, userId]
  );
  if (!row) throw new HttpError(404, 'Report not found.');
  return shapeOwn(row);
}

async function listMine(userId) {
  const [rows] = await pool.execute(
    `SELECT ${OWN_COLUMNS} FROM Site_Reports r JOIN Categories c ON c.category_id = r.category_id
      WHERE r.reporter_id = ? ORDER BY r.submitted_at DESC, r.report_id DESC`,
    [userId]
  );
  return rows.map(shapeOwn);
}

/** The reporter answers "request more information": updates the text and the report goes back to pending. */
async function updateOwn(userId, reportId, data) {
  const report = await getOwn(userId, reportId);
  if (report.status !== 'needs_info') {
    throw new HttpError(409, 'You can only change a report when an administrator has asked for more information.');
  }
  await pool.execute(
    "UPDATE Site_Reports SET description = ?, access_notes = ?, status = 'pending' WHERE report_id = ?",
    [data.description, data.access_notes, reportId]
  );
  return getOwn(userId, reportId);
}

/* ------------------------------------------------------------------ F8: community confirm and flag */

async function listNearby(userId, { lat, lng, radius }) {
  const box = boundingBox(lat, lng, radius);
  const [rows] = await pool.execute(
    `SELECT r.report_id, r.site_name, r.local_name, r.category_id, c.category_name, r.description, r.access_notes,
            r.latitude, r.longitude, r.photo_urls, r.status, r.confirm_count, r.flag_count, r.submitted_at,
            v.response AS my_response
       FROM Site_Reports r
       JOIN Categories c ON c.category_id = r.category_id
       LEFT JOIN Report_Verifications v ON v.report_id = r.report_id AND v.user_id = ?
      WHERE r.status IN ('pending','under_review') AND r.is_hidden = FALSE AND r.reporter_id <> ?
        AND r.latitude BETWEEN ? AND ? AND r.longitude BETWEEN ? AND ?`,
    [userId, userId, box.minLat, box.maxLat, box.minLng, box.maxLng]
  );
  return withinRadius(rows, lat, lng, radius).map((r) => ({
    ...r,
    photo_urls: parsePhotos(r.photo_urls),
    distance_km: Number(r.distance_km.toFixed(2)),
  }));
}

/**
 * One confirm or flag per user per report (unique key), never on your own report.
 * Counting and the status change happen in one transaction with the report row locked,
 * so two people responding at the same moment cannot both miss the threshold.
 */
async function respond(userId, reportId, { response, reason }) {
  return withTransaction(async (conn) => {
    const [[r]] = await conn.execute(
      'SELECT report_id, reporter_id, status, confirm_count, flag_count, is_hidden FROM Site_Reports WHERE report_id = ? FOR UPDATE',
      [reportId]
    );
    if (!r) throw new HttpError(404, 'Report not found.');
    if (r.reporter_id === userId) throw new HttpError(403, 'You cannot confirm or flag your own report.');
    if (!COMMUNITY_CAN_RESPOND.includes(r.status) || r.is_hidden) {
      throw new HttpError(409, 'This report is no longer open for confirmation.');
    }
    try {
      await conn.execute(
        'INSERT INTO Report_Verifications (report_id, user_id, response, reason) VALUES (?, ?, ?, ?)',
        [reportId, userId, response, response === 'flag' ? reason : reason || null]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'You have already responded to this report.');
      throw err;
    }
    const counts = {
      ...r,
      confirm_count: r.confirm_count + (response === 'confirm' ? 1 : 0),
      flag_count: r.flag_count + (response === 'flag' ? 1 : 0),
    };
    const next = afterResponse(counts);
    await conn.execute(
      'UPDATE Site_Reports SET confirm_count = ?, flag_count = ?, status = ?, is_hidden = ? WHERE report_id = ?',
      [counts.confirm_count, counts.flag_count, next.status, next.is_hidden, reportId]
    );
    return {
      report_id: reportId,
      my_response: response,
      confirm_count: counts.confirm_count,
      flag_count: counts.flag_count,
      status: next.status,
      is_hidden: next.is_hidden,
    };
  });
}

/* ------------------------------------------------------------------ F9: admin review */

const ADMIN_COLUMNS = `
  r.*, c.category_name,
  COALESCE(u.display_name, u.full_name) AS reporter_name, u.email AS reporter_email,
  na.name AS nearest_attraction_name, na.latitude AS nearest_attraction_lat, na.longitude AS nearest_attraction_lng,
  nr.site_name AS nearest_report_name, nr.latitude AS nearest_report_lat, nr.longitude AS nearest_report_lng,
  COALESCE(rv.display_name, rv.full_name) AS reviewer_name,
  (SELECT a.attraction_id FROM Attractions a WHERE a.report_id = r.report_id LIMIT 1) AS attraction_id`;

const ADMIN_FROM = `
  FROM Site_Reports r
  JOIN Categories c ON c.category_id = r.category_id
  JOIN Users u ON u.user_id = r.reporter_id
  LEFT JOIN Users rv ON rv.user_id = r.reviewed_by
  LEFT JOIN Attractions na ON na.attraction_id = r.nearest_attraction_id
  LEFT JOIN Site_Reports nr ON nr.report_id = r.nearest_report_id`;

function shapeAdmin(r) {
  const nearest = r.nearest_attraction_id
    ? { kind: 'attraction', id: r.nearest_attraction_id, name: r.nearest_attraction_name, latitude: Number(r.nearest_attraction_lat), longitude: Number(r.nearest_attraction_lng) }
    : r.nearest_report_id
      ? { kind: 'report', id: r.nearest_report_id, name: r.nearest_report_name, latitude: Number(r.nearest_report_lat), longitude: Number(r.nearest_report_lng) }
      : null;
  if (nearest) nearest.distance_m = Number(r.nearest_distance_m);
  const {
    nearest_attraction_name, nearest_attraction_lat, nearest_attraction_lng,
    nearest_report_name, nearest_report_lat, nearest_report_lng, ...rest
  } = r;
  return { ...rest, photo_urls: parsePhotos(r.photo_urls), public_access: Boolean(r.public_access), is_hidden: Boolean(r.is_hidden), nearest };
}

/** The review queue: most-confirmed first, then oldest first (FR-14). */
async function adminList({ status }) {
  const where = status === 'all' ? '' : status === 'open' ? `WHERE r.status IN (${OPEN.map(() => '?').join(',')})` : 'WHERE r.status = ?';
  const params = status === 'all' ? [] : status === 'open' ? OPEN : [status];
  const [rows] = await pool.execute(
    `SELECT ${ADMIN_COLUMNS} ${ADMIN_FROM} ${where} ORDER BY r.confirm_count DESC, r.submitted_at ASC, r.report_id ASC`,
    params
  );
  const [[counts]] = await pool.query(
    `SELECT SUM(status = 'pending') AS pending, SUM(status = 'under_review') AS under_review,
            SUM(status = 'needs_info') AS needs_info, SUM(status = 'approved') AS approved, SUM(status = 'rejected') AS rejected
       FROM Site_Reports`
  );
  const n = (v) => Number(v || 0);
  return {
    reports: rows.map(shapeAdmin),
    counts: { pending: n(counts.pending), under_review: n(counts.under_review), needs_info: n(counts.needs_info), approved: n(counts.approved), rejected: n(counts.rejected) },
  };
}

async function adminGet(reportId, conn = pool) {
  const [[row]] = await conn.execute(`SELECT ${ADMIN_COLUMNS} ${ADMIN_FROM} WHERE r.report_id = ?`, [reportId]);
  if (!row) throw new HttpError(404, 'Report not found.');
  const [responses] = await conn.execute(
    `SELECT v.response, v.reason, v.created_at, COALESCE(u.display_name, u.full_name) AS user_name
       FROM Report_Verifications v JOIN Users u ON u.user_id = v.user_id
      WHERE v.report_id = ? ORDER BY v.created_at DESC, v.verification_id DESC`,
    [reportId]
  );
  return { ...shapeAdmin(row), responses: responses.map((v) => ({ ...v, user_name: firstName(v.user_name) })) };
}

/**
 * Approve, reject or ask for more information, with optional edits.
 * Approval is one transaction: the edits, the new community Attractions row and the status change
 * are all saved, or none of them are.
 */
async function adminDecide(adminId, reportId, { action, note, edits }) {
  return withTransaction(async (conn) => {
    const [[r]] = await conn.execute('SELECT * FROM Site_Reports WHERE report_id = ? FOR UPDATE', [reportId]);
    if (!r) throw new HttpError(404, 'Report not found.');
    if (!canAdminDecide(r.status)) throw new HttpError(409, `This report has already been ${r.status}.`);

    const name = edits.site_name ?? r.site_name;
    const categoryId = edits.category_id ?? r.category_id;
    const description = edits.description ?? r.description;
    if (edits.category_id) {
      const [[cat]] = await conn.execute('SELECT category_id FROM Categories WHERE category_id = ?', [categoryId]);
      if (!cat) throw new HttpError(400, 'Choose a category.', [{ path: ['category_id'], message: 'Choose a category.' }]);
    }

    if (action === 'approve') {
      const photos = parsePhotos(r.photo_urls);
      await conn.execute(
        `INSERT INTO Attractions (name, category_id, description, latitude, longitude, address, image_url, source, report_id, status)
         VALUES (?, ?, ?, ?, ?, NULL, ?, 'community', ?, 'active')`,
        [name, categoryId, description, r.latitude, r.longitude, photos[0] || null, reportId]
      );
    }

    await conn.execute(
      `UPDATE Site_Reports SET site_name = ?, category_id = ?, description = ?, status = ?,
              reviewed_by = ?, review_note = ?, reviewed_at = UTC_TIMESTAMP()
        WHERE report_id = ?`,
      [name, categoryId, description, ADMIN_ACTIONS[action], adminId, note, reportId]
    );
    return adminGet(reportId, conn);
  });
}

module.exports = {
  DUPLICATE_METRES, DAILY_LIMIT,
  preflight, findNearest, create, listMine, getOwn, updateOwn,
  listNearby, respond,
  adminList, adminGet, adminDecide,
};
