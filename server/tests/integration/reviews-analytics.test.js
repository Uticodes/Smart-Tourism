const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');
const { resetDb, signedInAgent } = require('../helpers/db');
const { mrr, dayRange } = require('../../src/modules/analytics/analytics.service');

let cat = {};
let gardenId, galleryId, closedId;

beforeAll(async () => {
  await resetDb();
  const [cats] = await pool.query('SELECT category_id, category_name FROM Categories');
  cat = Object.fromEntries(cats.map((c) => [c.category_name, c.category_id]));
  const add = async (name, c, status = 'active') => {
    const [r] = await pool.execute('INSERT INTO Attractions (name, category_id, latitude, longitude, status) VALUES (?, ?, 9.06, 7.49, ?)', [name, cat[c], status]);
    return r.insertId;
  };
  gardenId = await add('Rock Garden', 'Parks & Nature');
  galleryId = await add('Craft Gallery', 'Arts & Culture');
  closedId = await add('Closed Museum', 'Arts & Culture', 'inactive');
});
afterAll(() => pool.end());

describe('Reviews and ratings (FR-08)', () => {
  test('a review is saved and the average is recalculated', async () => {
    const a = await signedInAgent(app);
    const b = await signedInAgent(app);
    const first = await a.post(`/api/attractions/${gardenId}/reviews`).send({ rating: 5, comment: '  Lovely at sunset.  ' }).expect(201);
    expect(first.body.summary).toEqual({ avg_rating: 5, count: 1, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } });
    expect(first.body.my_review).toEqual(expect.objectContaining({ rating: 5, comment: 'Lovely at sunset.', is_mine: true }));

    await b.post(`/api/attractions/${gardenId}/reviews`).send({ rating: 2 }).expect(201);
    const [[row]] = await pool.execute('SELECT avg_rating FROM Attractions WHERE attraction_id = ?', [gardenId]);
    expect(row.avg_rating).toBe(3.5);

    // The search results and details page carry the new average.
    const details = await request(app).get(`/api/attractions/${gardenId}`).expect(200);
    expect(details.body.attraction).toEqual(expect.objectContaining({ avg_rating: 3.5, review_count: 2 }));
  });

  test('one review per user: a second one is refused, but it can be edited or deleted', async () => {
    const u = await signedInAgent(app);
    await u.post(`/api/attractions/${galleryId}/reviews`).send({ rating: 3 }).expect(201);
    const dup = await u.post(`/api/attractions/${galleryId}/reviews`).send({ rating: 4 }).expect(409);
    expect(dup.body.error).toMatch(/already reviewed/);

    const edited = await u.put(`/api/attractions/${galleryId}/reviews/mine`).send({ rating: 4, comment: 'Better on a second visit' }).expect(200);
    expect(edited.body.summary.avg_rating).toBe(4);
    expect(edited.body.reviews).toHaveLength(1);

    const removed = await u.delete(`/api/attractions/${galleryId}/reviews/mine`).expect(200);
    expect(removed.body.summary).toEqual(expect.objectContaining({ avg_rating: null, count: 0 }));
    const [[row]] = await pool.execute('SELECT avg_rating FROM Attractions WHERE attraction_id = ?', [galleryId]);
    expect(row.avg_rating).toBeNull();
  });

  test('ratings must be whole stars from 1 to 5, and comments under 1,000 characters', async () => {
    const u = await signedInAgent(app);
    for (const rating of [0, 6, 3.5, 'five']) {
      await u.post(`/api/attractions/${galleryId}/reviews`).send({ rating }).expect(400);
    }
    await u.post(`/api/attractions/${galleryId}/reviews`).send({ rating: 4, comment: 'x'.repeat(1001) }).expect(400);
  });

  test('guests can read reviews but not write them; reviewers show by first name only', async () => {
    await request(app).post(`/api/attractions/${gardenId}/reviews`).send({ rating: 5 }).expect(401);
    await pool.execute("UPDATE Users SET full_name = 'Ngozi Adaeze Okeke', display_name = NULL WHERE email LIKE 'tourist-%' ORDER BY user_id LIMIT 1");
    const res = await request(app).get(`/api/attractions/${gardenId}/reviews`).expect(200);
    expect(res.body.my_review).toBeNull();
    expect(res.body.reviews.map((r) => r.author)).toContain('Ngozi');
    expect(JSON.stringify(res.body)).not.toMatch(/Okeke|@/);
  });

  test('inactive attractions cannot be reviewed', async () => {
    const u = await signedInAgent(app);
    await u.post(`/api/attractions/${closedId}/reviews`).send({ rating: 5 }).expect(404);
  });
});

describe('Admin analytics (FR-10)', () => {
  test('MRR averages 1 ÷ rank over lists where something was opened', () => {
    const r = mrr([{ selected_rank: 1 }, { selected_rank: 2 }, { selected_rank: 4 }, { selected_rank: null }]);
    expect(r.value).toBeCloseTo((1 + 0.5 + 0.25) / 3, 3);
    expect(r).toEqual(expect.objectContaining({ lists_shown: 4, lists_with_selection: 3, selection_rate: 0.75 }));
    expect(r.rank_distribution.find((d) => d.rank === '4').count).toBe(1);
    expect(mrr([]).value).toBeNull();
  });

  test('dayRange lists every day, inclusive', () => {
    expect(dayRange('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  });

  test('only admins can see analytics', async () => {
    const tourist = await signedInAgent(app);
    await tourist.get('/api/admin/analytics').expect(403);
    await request(app).get('/api/admin/analytics').expect(401);
  });

  test('the dashboard numbers match the activity in the database', async () => {
    const admin = await signedInAgent(app, { role: 'admin' });
    const before = (await admin.get('/api/admin/analytics').query({ range: '7' }).expect(200)).body;

    // 2 recommendation lists (opened at rank 1 and rank 2), 1 Explore search filtered by category, 1 unfiltered.
    const u = await signedInAgent(app);
    const centre = { lat: 9.06, lng: 7.49, radius: 5 };
    const l1 = (await u.get('/api/recommendations').query(centre)).body;
    await u.post('/api/recommendations/selection').send({ search_id: l1.search_id, attraction_id: gardenId, rank: 1 }).expect(200);
    const l2 = (await u.get('/api/recommendations').query(centre)).body;
    await u.post('/api/recommendations/selection').send({ search_id: l2.search_id, attraction_id: galleryId, rank: 2 }).expect(200);
    await u.get('/api/attractions/nearby').query({ ...centre, category: cat['Parks & Nature'] }).expect(200);
    await u.get('/api/attractions/nearby').query(centre).expect(200);
    // An old search outside the 7-day window must not count.
    await pool.execute("INSERT INTO Search_Logs (query_text, latitude, longitude, searched_at) VALUES ('Parks & Nature', 9.06, 7.49, UTC_TIMESTAMP() - INTERVAL 40 DAY)");

    const res = await admin.get('/api/admin/analytics').query({ range: '7' }).expect(200);
    const d = res.body;
    expect(d.range.days).toBe(7);
    expect(d.searches.per_day).toHaveLength(7);
    expect(d.searches.recommendations - before.searches.recommendations).toBe(2);
    expect(d.searches.explore - before.searches.explore).toBe(2);
    expect(d.searches.total).toBe(d.searches.per_day.reduce((s, x) => s + x.explore + x.recommendations, 0));
    expect(d.top_categories).toEqual([{ category_name: 'Parks & Nature', searches: 1 }]);
    expect(d.mrr).toEqual(expect.objectContaining({ value: 0.75, lists_with_selection: 2 }));
    expect(d.most_opened.map((a) => a.name).sort()).toEqual(['Craft Gallery', 'Rock Garden']);
    expect(d.top_rated[0]).toEqual(expect.objectContaining({ name: 'Rock Garden', avg_rating: 3.5, review_count: 2 }));
    expect(d.users.total).toBeGreaterThan(0);

    const all = (await admin.get('/api/admin/analytics').query({ range: 'all' }).expect(200)).body;
    expect(all.top_categories[0]).toEqual({ category_name: 'Parks & Nature', searches: 2 });
    expect(all.searches.per_day.length).toBeGreaterThanOrEqual(41);
  });

  test('top-rated weighs the number of reviews, so one 5-star review does not come first', async () => {
    const admin = await signedInAgent(app, { role: 'admin' });
    const add = async (name) => (await pool.execute('INSERT INTO Attractions (name, category_id, latitude, longitude) VALUES (?, ?, 9.0, 7.4)', [name, cat['Historical Sites']]))[0].insertId;
    const once = await add('One Lucky Review');
    const many = await add('Consistently Good');
    await (await signedInAgent(app)).post(`/api/attractions/${once}/reviews`).send({ rating: 5 }).expect(201);
    for (const r of [5, 5, 5, 4, 5]) await (await signedInAgent(app)).post(`/api/attractions/${many}/reviews`).send({ rating: r }).expect(201);
    const top = (await admin.get('/api/admin/analytics').expect(200)).body.top_rated.map((a) => a.name);
    expect(top.indexOf('Consistently Good')).toBeLessThan(top.indexOf('One Lucky Review'));
  });

  test('report statistics: decisions, approval rate and hours to decision', async () => {
    const admin = await signedInAgent(app, { role: 'admin' });
    const [[u]] = await pool.query("SELECT user_id FROM Users WHERE role = 'tourist' LIMIT 1");
    const insert = (status, hoursAgoSubmitted, hoursAgoReviewed, nearest = null) => pool.execute(
      `INSERT INTO Site_Reports (reporter_id, category_id, site_name, description, latitude, longitude, photo_urls, public_access, status, nearest_distance_m, submitted_at, reviewed_at)
       VALUES (?, ?, 'R', 'A description long enough.', 9.1, 7.4, '[]', TRUE, ?, ?, UTC_TIMESTAMP() - INTERVAL ? HOUR, ${hoursAgoReviewed == null ? 'NULL' : 'UTC_TIMESTAMP() - INTERVAL ? HOUR'})`,
      [u.user_id, cat['Parks & Nature'], status, nearest, hoursAgoSubmitted, ...(hoursAgoReviewed == null ? [] : [hoursAgoReviewed])]
    );
    await insert('approved', 30, 20);       // 10 h to decision
    await insert('rejected', 10, 4);        // 6 h
    await insert('pending', 2, null, 90);   // near-duplicate the reporter sent anyway
    const r = (await admin.get('/api/admin/analytics').query({ range: '30' }).expect(200)).body.reports;
    expect(r).toEqual(expect.objectContaining({ submitted: 3, approved: 1, rejected: 1, open: 1, near_duplicates: 1, approval_rate: 0.5, avg_hours_to_decision: 8 }));
  });
});
