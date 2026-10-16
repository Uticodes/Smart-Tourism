const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');
const { resetDb, signedInAgent } = require('../helpers/db');

const CENTRE = { lat: 9.0579, lng: 7.4951 };
let ids = {}; // attraction name -> id
let cat = {}; // category name -> id

// Same distance band, different categories and ratings, so the category weight decides.
const POINTS = [
  ['Nearby Gallery', 'Arts & Culture', 9.0620, 7.4960, 4.5], // ~0.5 km, well rated, NOT a preference
  ['Quiet Garden', 'Parks & Nature', 9.0700, 7.5000, null], // ~1.4 km, unrated, preference
  ['Hill Trail', 'Parks & Nature', 9.1000, 7.4500, 4.0],    // ~6.8 km, preference
  ['Old Mosque', 'Religious Sites', 9.0800, 7.4900, 4.0],   // ~2.5 km, NOT a preference
];

beforeAll(async () => {
  await resetDb();
  const [cats] = await pool.query('SELECT category_id, category_name FROM Categories');
  cat = Object.fromEntries(cats.map((c) => [c.category_name, c.category_id]));
  for (const [name, c, lat, lng, rating] of POINTS) {
    const [r] = await pool.execute(
      'INSERT INTO Attractions (name, category_id, latitude, longitude, avg_rating) VALUES (?, ?, ?, ?, ?)',
      [name, cat[c], lat, lng, rating]
    );
    ids[name] = r.insertId;
  }
});
afterAll(() => pool.end());

describe('TC-REC-01 Recommendations follow the user’s interests', () => {
  test('attractions in the user’s chosen categories score higher and rank first', async () => {
    const user = await signedInAgent(app);
    await user.put('/api/users/me/preferences').send({ category_ids: [cat['Parks & Nature']] }).expect(200);

    const res = await user.get('/api/recommendations').query({ ...CENTRE, radius: 10 }).expect(200);
    expect(res.body.personalised).toBe(true);
    expect(res.body.preferences.map((p) => p.category_name)).toEqual(['Parks & Nature']);

    const list = res.body.attractions;
    const names = list.map((a) => a.name);
    // Both Parks & Nature places rank above the closer, better-rated places in other categories.
    expect(names.slice(0, 2).sort()).toEqual(['Hill Trail', 'Quiet Garden']);
    const worstMatch = Math.min(...list.filter((a) => a.matches_preference).map((a) => a.score));
    const bestOther = Math.max(...list.filter((a) => !a.matches_preference).map((a) => a.score));
    expect(worstMatch).toBeGreaterThan(bestOther);

    // Scores are sorted, ranks are 1..n, every item carries its score parts and distance.
    expect(list.map((a) => a.rank)).toEqual([1, 2, 3, 4]);
    for (let i = 1; i < list.length; i += 1) expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score);
    for (const a of list) {
      expect(a.score).toBeGreaterThan(0);
      expect(a.score).toBeLessThanOrEqual(1);
      expect(a.score_parts).toEqual(expect.objectContaining({ category: expect.any(Number), rating: expect.any(Number), proximity: expect.any(Number) }));
      expect(typeof a.distance_km).toBe('number');
    }
  });

  test('guests get a non-personalised ranking by rating and distance', async () => {
    const res = await request(app).get('/api/recommendations').query({ ...CENTRE, radius: 10 }).expect(200);
    expect(res.body.personalised).toBe(false);
    expect(res.body.attractions[0].name).toBe('Nearby Gallery'); // closest and best rated
    expect(res.body.attractions.every((a) => a.matches_preference === false)).toBe(true);
  });

  test('inactive attractions and places outside the radius are never recommended', async () => {
    await pool.execute("UPDATE Attractions SET status = 'inactive' WHERE attraction_id = ?", [ids['Old Mosque']]);
    const res = await request(app).get('/api/recommendations').query({ ...CENTRE, radius: 3 }).expect(200);
    const names = res.body.attractions.map((a) => a.name);
    expect(names).not.toContain('Old Mosque');
    expect(names).not.toContain('Hill Trail');
    await pool.execute("UPDATE Attractions SET status = 'active' WHERE attraction_id = ?", [ids['Old Mosque']]);
  });

  test('rejects a radius above 50 km', async () => {
    await request(app).get('/api/recommendations').query({ ...CENTRE, radius: 80 }).expect(400);
  });
});

describe('Selection logging for MRR', () => {
  test('records the first result opened and its rank, once per search', async () => {
    const user = await signedInAgent(app);
    const { body } = await user.get('/api/recommendations').query({ ...CENTRE, radius: 10 }).expect(200);
    const second = body.attractions[1];

    const first = await user.post('/api/recommendations/selection')
      .send({ search_id: body.search_id, attraction_id: second.attraction_id, rank: 2 }).expect(200);
    expect(first.body.recorded).toBe(true);
    const again = await user.post('/api/recommendations/selection')
      .send({ search_id: body.search_id, attraction_id: body.attractions[0].attraction_id, rank: 1 }).expect(200);
    expect(again.body.recorded).toBe(false);

    const [[log]] = await pool.execute('SELECT selected_attraction_id, selected_rank FROM Search_Logs WHERE log_id = ?', [body.search_id]);
    expect(log).toEqual({ selected_attraction_id: second.attraction_id, selected_rank: 2 });
  });

  test('a user cannot record a selection on someone else’s search', async () => {
    const owner = await signedInAgent(app);
    const other = await signedInAgent(app);
    const { body } = await owner.get('/api/recommendations').query(CENTRE).expect(200);
    await other.post('/api/recommendations/selection')
      .send({ search_id: body.search_id, attraction_id: body.attractions[0].attraction_id, rank: 1 }).expect(403);
  });

  test('unknown searches are a 404', async () => {
    await request(app).post('/api/recommendations/selection').send({ search_id: 999999, attraction_id: ids['Hill Trail'], rank: 1 }).expect(404);
  });
});

describe('TC-NAV-01 Attraction details and directions', () => {
  test('details include a Google Maps directions link to the attraction’s coordinates', async () => {
    const res = await request(app).get(`/api/attractions/${ids['Quiet Garden']}`).expect(200);
    const a = res.body.attraction;
    expect(a.name).toBe('Quiet Garden');
    expect(a.category_name).toBe('Parks & Nature');
    expect(Array.isArray(a.photos)).toBe(true);
    expect(a.community).toBeNull();
    const url = new URL(a.directions_url);
    expect(url.hostname).toBe('www.google.com');
    expect(url.pathname).toBe('/maps/dir/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('destination')).toBe(`${Number(a.latitude).toFixed(6)},${Number(a.longitude).toFixed(6)}`);
  });

  test('community-discovered sites show the contributor’s first name and approval date', async () => {
    const [[u]] = await pool.query("SELECT user_id FROM Users LIMIT 1");
    await pool.execute("UPDATE Users SET display_name = NULL, full_name = 'Halima Sani' WHERE user_id = ?", [u.user_id]);
    const [r] = await pool.execute(
      `INSERT INTO Site_Reports (reporter_id, category_id, site_name, local_name, description, latitude, longitude, photo_urls, public_access, status, reviewed_at)
       VALUES (?, ?, 'Hidden Falls', 'Ruwan Dutse', 'Small seasonal waterfall.', 9.06, 7.49, ?, TRUE, 'approved', '2026-10-01 10:00:00')`,
      [u.user_id, cat['Parks & Nature'], JSON.stringify(['/uploads/a.jpg'])]
    );
    const [a] = await pool.execute(
      "INSERT INTO Attractions (name, category_id, latitude, longitude, source, report_id) VALUES ('Hidden Falls', ?, 9.06, 7.49, 'community', ?)",
      [cat['Parks & Nature'], r.insertId]
    );
    const res = await request(app).get(`/api/attractions/${a.insertId}`).expect(200);
    expect(res.body.attraction.community).toEqual(expect.objectContaining({ contributor: 'Halima', local_name: 'Ruwan Dutse' }));
    expect(res.body.attraction.community.verified_at).toBeTruthy();
    expect(res.body.attraction.photos).toEqual(['/uploads/a.jpg']);
  });

  test('inactive or unknown attractions are a 404', async () => {
    await request(app).get('/api/attractions/999999').expect(404);
  });
});
