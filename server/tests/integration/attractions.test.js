const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');
const { resetDb, signedInAgent } = require('../helpers/db');
const { haversineKm } = require('../../src/lib/haversine');

const CENTRE = { lat: 9.0579, lng: 7.4951 };
let admin, tourist, parksId, artsId;

// Fixed points at known distances from the centre.
const POINTS = [
  ['Near Park', 'Parks & Nature', 9.0620, 7.4960],      // ~0.5 km
  ['Mid Gallery', 'Arts & Culture', 9.1000, 7.4500],    // ~6.8 km
  ['Edge Hill', 'Parks & Nature', 9.1400, 7.4400],      // ~10.9 km (just outside 10 km)
  ['Far Village', 'Arts & Culture', 9.2770, 7.3809],    // ~27.5 km
];

beforeAll(async () => {
  await resetDb();
  const [cats] = await pool.query('SELECT category_id, category_name FROM Categories');
  const id = Object.fromEntries(cats.map((c) => [c.category_name, c.category_id]));
  parksId = id['Parks & Nature'];
  artsId = id['Arts & Culture'];
  for (const [name, cat, lat, lng] of POINTS) {
    await pool.execute('INSERT INTO Attractions (name, category_id, latitude, longitude) VALUES (?, ?, ?, ?)', [name, id[cat], lat, lng]);
  }
  admin = await signedInAgent(app, { role: 'admin' });
  tourist = await signedInAgent(app, { role: 'tourist' });
});
afterAll(() => pool.end());

describe('TC-SEARCH-01 Location radius', () => {
  test('radius 10 km returns only attractions within 10 km, nearest first, with distances', async () => {
    const res = await request(app).get('/api/attractions/nearby').query({ ...CENTRE, radius: 10 }).expect(200);
    const names = res.body.attractions.map((a) => a.name);
    expect(names).toEqual(['Near Park', 'Mid Gallery']);
    for (const a of res.body.attractions) {
      expect(a.distance_km).toBeLessThanOrEqual(10);
      expect(a.distance_km).toBeCloseTo(haversineKm(CENTRE.lat, CENTRE.lng, a.latitude, a.longitude), 1);
    }
  });

  test('a larger radius includes the farther attractions', async () => {
    const res = await request(app).get('/api/attractions/nearby').query({ ...CENTRE, radius: 30 }).expect(200);
    expect(res.body.count).toBe(4);
  });

  test('filters by category', async () => {
    const res = await request(app).get('/api/attractions/nearby').query({ ...CENTRE, radius: 30, category: artsId }).expect(200);
    expect(res.body.attractions.every((a) => a.category_id === artsId)).toBe(true);
    expect(res.body.count).toBe(2);
  });

  test('logs every search for analytics, with the user when signed in', async () => {
    const res = await tourist.get('/api/attractions/nearby').query({ ...CENTRE, radius: 5, category: parksId }).expect(200);
    const [[log]] = await pool.execute('SELECT * FROM Search_Logs WHERE log_id = ?', [res.body.search_id]);
    expect(log.user_id).not.toBeNull();
    expect(log.query_text).toBe('Parks & Nature');
  });

  test('rejects a radius outside 1 to 50 km', async () => {
    await request(app).get('/api/attractions/nearby').query({ ...CENTRE, radius: 80 }).expect(400);
  });
});

describe('TC-ADM-01 Attraction management', () => {
  const newAttraction = () => ({
    name: 'Test Waterfall', category_id: parksId, description: 'A test site.',
    latitude: 9.0700, longitude: 7.5000, address: 'Test District', status: 'active',
  });

  test('an admin creates an attraction and it appears in search', async () => {
    const created = await admin.post('/api/admin/attractions').send(newAttraction()).expect(201);
    expect(created.body.attraction).toMatchObject({ name: 'Test Waterfall', source: 'curated', status: 'active' });

    const res = await request(app).get('/api/attractions/nearby').query({ ...CENTRE, radius: 5 }).expect(200);
    expect(res.body.attractions.map((a) => a.name)).toContain('Test Waterfall');
  });

  test('editing changes the record; deactivating removes it from search but keeps the row', async () => {
    const { body } = await admin.post('/api/admin/attractions').send({ ...newAttraction(), name: 'Old Name' }).expect(201);
    const id = body.attraction.attraction_id;
    await admin.put(`/api/admin/attractions/${id}`).send({ ...newAttraction(), name: 'New Name' }).expect(200);
    await admin.delete(`/api/admin/attractions/${id}`).expect(200);

    const search = await request(app).get('/api/attractions/nearby').query({ ...CENTRE, radius: 5 });
    expect(search.body.attractions.map((a) => a.attraction_id)).not.toContain(id);
    await request(app).get(`/api/attractions/${id}`).expect(404);
    const [[row]] = await pool.execute('SELECT name, status FROM Attractions WHERE attraction_id = ?', [id]);
    expect(row).toEqual({ name: 'New Name', status: 'inactive' });
  });

  test('refuses coordinates outside the FCT', async () => {
    const res = await admin.post('/api/admin/attractions').send({ ...newAttraction(), latitude: 6.5244, longitude: 3.3792 }).expect(400);
    expect(res.body.details[0].path).toEqual(['latitude']);
  });

  test('tourists and signed-out visitors cannot manage attractions', async () => {
    await tourist.post('/api/admin/attractions').send(newAttraction()).expect(403);
    await request(app).post('/api/admin/attractions').send(newAttraction()).expect(401);
    await tourist.get('/api/admin/attractions').expect(403);
  });
});

describe('Category management', () => {
  test('adds and renames a category; refuses to delete one in use', async () => {
    let res = await admin.post('/api/admin/categories').send({ category_name: 'Markets' }).expect(201);
    const markets = res.body.categories.find((c) => c.category_name === 'Markets');
    res = await admin.put(`/api/admin/categories/${markets.category_id}`).send({ category_name: 'Craft Markets' }).expect(200);
    expect(res.body.categories.map((c) => c.category_name)).toContain('Craft Markets');
    await admin.post('/api/admin/categories').send({ category_name: 'Craft Markets' }).expect(409);
    await admin.delete(`/api/admin/categories/${parksId}`).expect(409);
    await admin.delete(`/api/admin/categories/${markets.category_id}`).expect(200);
  });
});
