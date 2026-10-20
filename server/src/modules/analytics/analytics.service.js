const { pool } = require('../../config/db');
const eventLog = require('../../lib/eventLog');

// Abuja is on West Africa Time all year (UTC+1, no daylight saving), so days are counted in local time.
const LOCAL_OFFSET = '+01:00';
const LOCAL_OFFSET_MS = 60 * 60 * 1000;
const localDay = (col) => `DATE(CONVERT_TZ(${col}, '+00:00', '${LOCAL_OFFSET}'))`;
const RECS = 'recommendations'; // query_text written by GET /api/recommendations

/** "YYYY-MM-DD" of a JS Date in Abuja time. */
const dayKey = (d) => new Date(d.getTime() + LOCAL_OFFSET_MS).toISOString().slice(0, 10);

/** Every day from `from` to today (Abuja time), so the chart shows quiet days as zero, not as gaps. */
function dayRange(fromKey, toKey) {
  const out = [];
  for (const d = new Date(`${fromKey}T00:00:00Z`); d.toISOString().slice(0, 10) <= toKey; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Mean Reciprocal Rank (Section 3.8.3): for each recommendation list where the user opened a place,
 * score 1 ÷ the position of that place (1st = 1, 2nd = 0.5, 3rd = 0.33 …) and average.
 * Lists where nothing was opened are reported separately as the selection rate.
 */
function mrr(rows) {
  const picked = rows.filter((r) => r.selected_rank);
  const value = picked.length ? picked.reduce((s, r) => s + 1 / r.selected_rank, 0) / picked.length : null;
  return {
    value: value == null ? null : Math.round(value * 1000) / 1000,
    lists_shown: rows.length,
    lists_with_selection: picked.length,
    selection_rate: rows.length ? Math.round((picked.length / rows.length) * 1000) / 1000 : null,
    rank_distribution: [1, 2, 3, 4, 5].map((rank) => ({ rank: String(rank), count: picked.filter((r) => r.selected_rank === rank).length }))
      .concat([{ rank: '6+', count: picked.filter((r) => r.selected_rank >= 6).length }]),
  };
}

/** FR-10: everything the admin dashboard shows, for the last `days` days (or all time when days is null). */
async function summary({ days }) {
  const since = days ? 'UTC_TIMESTAMP() - INTERVAL ? DAY' : "'1970-01-01'";
  const p = (...rest) => (days ? [days, ...rest] : rest);

  const [searchDays] = await pool.execute(
    `SELECT ${localDay('searched_at')} AS day,
            SUM(query_text = '${RECS}') AS recommendations,
            SUM(query_text IS NULL OR query_text <> '${RECS}') AS explore
       FROM Search_Logs WHERE searched_at >= ${since}
      GROUP BY day ORDER BY day`,
    p()
  );

  const [topCategories] = await pool.execute(
    `SELECT query_text AS category_name, COUNT(*) AS searches
       FROM Search_Logs
      WHERE searched_at >= ${since} AND query_text IS NOT NULL AND query_text <> '${RECS}'
      GROUP BY query_text ORDER BY searches DESC, category_name LIMIT 5`,
    p()
  );

  // Ranked by a Bayesian average so one 5-star review does not outrank forty 4.8s:
  // (C × overall mean + sum of ratings) ÷ (C + number of reviews), with C = 3. The real average is still shown.
  const [topRated] = await pool.execute(
    `SELECT a.attraction_id, a.name, a.source, a.avg_rating, c.category_name, COUNT(r.review_id) AS review_count,
            (3 * MAX(g.mean) + SUM(r.rating)) / (3 + COUNT(r.review_id)) AS weighted
       FROM Attractions a
       JOIN Categories c ON c.category_id = a.category_id
       JOIN Reviews r ON r.attraction_id = a.attraction_id
       CROSS JOIN (SELECT AVG(rating) AS mean FROM Reviews) g
      WHERE a.status = 'active'
      GROUP BY a.attraction_id
      ORDER BY weighted DESC, review_count DESC, a.name LIMIT 5`
  );

  // "Most opened": results people clicked from a search or recommendation list (Search_Logs.selected_attraction_id).
  const [mostOpened] = await pool.execute(
    `SELECT a.attraction_id, a.name, a.source, c.category_name, COUNT(*) AS opens
       FROM Search_Logs s
       JOIN Attractions a ON a.attraction_id = s.selected_attraction_id
       JOIN Categories c ON c.category_id = a.category_id
      WHERE s.searched_at >= ${since}
      GROUP BY a.attraction_id
      ORDER BY opens DESC, a.name LIMIT 5`,
    p()
  );

  const [recLists] = await pool.execute(
    `SELECT selected_rank FROM Search_Logs WHERE query_text = '${RECS}' AND searched_at >= ${since}`,
    p()
  );

  const [[users]] = await pool.execute(
    `SELECT COUNT(*) AS total, SUM(created_at >= ${since}) AS new_in_range FROM Users WHERE role = 'tourist'`,
    p()
  );

  const [[reviews]] = await pool.execute(
    `SELECT COUNT(*) AS total, SUM(created_at >= ${since}) AS new_in_range FROM Reviews`,
    p()
  );

  const [[attractions]] = await pool.query(
    `SELECT SUM(source = 'curated') AS curated, SUM(source = 'community') AS community
       FROM Attractions WHERE status = 'active'`
  );

  // Report pipeline, for reports submitted in the range.
  const [[reports]] = await pool.execute(
    `SELECT COUNT(*) AS submitted,
            SUM(status = 'approved') AS approved,
            SUM(status = 'rejected') AS rejected,
            SUM(status IN ('pending','under_review','needs_info')) AS open,
            SUM(status = 'needs_info') AS needs_info,
            SUM(is_hidden) AS hidden_by_flags,
            SUM(nearest_distance_m IS NOT NULL AND nearest_distance_m <= 150) AS near_duplicates,
            AVG(CASE WHEN status IN ('approved','rejected') THEN TIMESTAMPDIFF(MINUTE, submitted_at, reviewed_at) END) AS avg_minutes_to_decision
       FROM Site_Reports WHERE submitted_at >= ${since}`,
    p()
  );

  const [[community]] = await pool.execute(
    `SELECT COUNT(*) AS responses, SUM(response = 'confirm') AS confirms, SUM(response = 'flag') AS flags
       FROM Report_Verifications WHERE created_at >= ${since}`,
    p()
  );

  const n = (v) => Number(v || 0);
  const warnings = eventLog.read('duplicate-warnings', days ? new Date(Date.now() - days * 86400000) : null);
  const today = dayKey(new Date());
  const byDay = Object.fromEntries(searchDays.map((r) => [new Date(r.day).toISOString().slice(0, 10), r]));
  const firstKey = days
    ? dayKey(new Date(Date.now() - (days - 1) * 86400000))
    : searchDays.length ? new Date(searchDays[0].day).toISOString().slice(0, 10) : today;
  const series = dayRange(firstKey, today).map((day) => ({
    day,
    explore: n(byDay[day]?.explore),
    recommendations: n(byDay[day]?.recommendations),
  }));
  const decided = n(reports.approved) + n(reports.rejected);

  return {
    range: { days: days || null, from: firstKey, to: today, timezone: 'Africa/Lagos (UTC+1)' },
    searches: {
      total: series.reduce((s, d) => s + d.explore + d.recommendations, 0),
      explore: series.reduce((s, d) => s + d.explore, 0),
      recommendations: series.reduce((s, d) => s + d.recommendations, 0),
      per_day: series,
    },
    top_categories: topCategories.map((r) => ({ category_name: r.category_name, searches: n(r.searches) })),
    top_rated: topRated.map(({ weighted, ...r }) => ({ ...r, review_count: n(r.review_count) })),
    most_opened: mostOpened.map((r) => ({ ...r, opens: n(r.opens) })),
    mrr: mrr(recLists),
    users: { total: n(users.total), new_in_range: n(users.new_in_range) },
    reviews: { total: n(reviews.total), new_in_range: n(reviews.new_in_range) },
    attractions: { curated: n(attractions.curated), community: n(attractions.community) },
    reports: {
      submitted: n(reports.submitted),
      approved: n(reports.approved),
      rejected: n(reports.rejected),
      open: n(reports.open),
      needs_info: n(reports.needs_info),
      hidden_by_flags: n(reports.hidden_by_flags),
      near_duplicates: n(reports.near_duplicates),
      duplicates_caught: warnings.length,
      approval_rate: decided ? Math.round((n(reports.approved) / decided) * 1000) / 1000 : null,
      avg_hours_to_decision: reports.avg_minutes_to_decision == null ? null : Math.round((Number(reports.avg_minutes_to_decision) / 60) * 10) / 10,
      community_responses: n(community.responses),
      confirms: n(community.confirms),
      flags: n(community.flags),
    },
  };
}

module.exports = { summary, mrr, dayRange, dayKey };
