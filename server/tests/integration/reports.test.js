const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const request = require('supertest');
const app = require('../../src/app');
const env = require('../../src/config/env');
const { pool } = require('../../src/config/db');
const { resetDb, signedInAgent } = require('../helpers/db');
const { photoWithGps, png } = require('../helpers/images');

const CENTRE = { lat: 9.0579, lng: 7.4951 };
let cat = {};
let parkId; // existing curated attraction at CENTRE
let jpeg;

/** Builds a multipart report. `fields` overrides the defaults; `photos` is a list of buffers. */
function send(agent, fields = {}, photos = [jpeg]) {
  const f = {
    site_name: 'Ushafa Rock Pools',
    local_name: 'Ruwan Dutse',
    category_id: cat['Parks & Nature'],
    description: 'Clear rock pools below the granite outcrop, used by locals for picnics.',
    access_notes: 'Footpath from the village market, about 10 minutes.',
    latitude: 9.2100,
    longitude: 7.4200,
    public_access: 'true',
    ...fields,
  };
  let req = agent.post('/api/reports');
  for (const [k, v] of Object.entries(f)) if (v !== undefined) req = req.field(k, String(v));
  photos.forEach((p, i) => { req = req.attach('photos', p, { filename: `photo${i}.jpg`, contentType: 'image/jpeg' }); });
  return req;
}

const uploadFiles = () => {
  const dir = path.join(env.uploadDir, 'reports');
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};

beforeAll(async () => {
  await resetDb();
  fs.rmSync(env.uploadDir, { recursive: true, force: true });
  jpeg = await photoWithGps();
  const [cats] = await pool.query('SELECT category_id, category_name FROM Categories');
  cat = Object.fromEntries(cats.map((c) => [c.category_name, c.category_id]));
  const [r] = await pool.execute(
    "INSERT INTO Attractions (name, category_id, latitude, longitude) VALUES ('Central Park', ?, ?, ?)",
    [cat['Parks & Nature'], CENTRE.lat, CENTRE.lng]
  );
  parkId = r.insertId;
});
afterAll(() => pool.end());

describe('TC-REP-01 Submitting a report', () => {
  test('a valid report is saved as pending with re-encoded photos', async () => {
    const user = await signedInAgent(app);
    const res = await send(user, {}, [jpeg, await png()]).expect(201);
    const r = res.body.report;
    expect(r.status).toBe('pending');
    expect(r.site_name).toBe('Ushafa Rock Pools');
    expect(r.confirm_count).toBe(0);
    expect(r.photo_urls).toHaveLength(2);
    for (const url of r.photo_urls) expect(url).toMatch(/^\/uploads\/reports\/[0-9a-f-]{36}\.jpg$/);

    // The saved file is served, is a JPEG, and has no EXIF (so no GPS tags).
    const file = await request(app).get(r.photo_urls[0]).buffer(true).parse((resp, cb) => {
      const chunks = []; resp.on('data', (c) => chunks.push(c)); resp.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    const meta = await sharp(file.body).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();
    expect((await sharp(jpeg).metadata()).exif).toBeDefined(); // the original did have EXIF
  });

  test('guests cannot report', async () => {
    await send(request(app)).expect(401);
  });

  test('photos are required, must be images, and at most 3', async () => {
    const user = await signedInAgent(app);
    const spot = { latitude: 8.6000, longitude: 7.6000 };
    const none = await send(user, spot, []).expect(400);
    expect(none.body.details[0].path).toEqual(['photos']);
    const bad = await send(user, spot, [Buffer.from('not really an image')]).expect(400);
    expect(bad.body.error).toMatch(/not a readable image/);
    await send(user, spot, [jpeg, jpeg, jpeg, jpeg]).expect(400);
    expect((await user.get('/api/reports/mine')).body.reports).toHaveLength(0);
  });

  test('the public-access declaration is required', async () => {
    const user = await signedInAgent(app);
    const res = await send(user, { public_access: 'false' }).expect(400);
    expect(res.body.details.map((d) => d.path[0])).toContain('public_access');
  });

  test('a user can send at most 5 reports in 24 hours', async () => {
    const user = await signedInAgent(app);
    for (let i = 0; i < 5; i += 1) {
      await send(user, { site_name: `Spot ${i}`, latitude: 8.95 + i * 0.01, longitude: 7.10 }).expect(201);
    }
    const res = await send(user, { site_name: 'One too many', latitude: 9.0, longitude: 7.05 }).expect(429);
    expect(res.body.code).toBe('DAILY_LIMIT');
  });
});

describe('TC-REP-02 Boundary check', () => {
  test('Lagos coordinates are rejected and no photo is kept', async () => {
    const user = await signedInAgent(app);
    const before = uploadFiles().length;
    const res = await send(user, { latitude: 6.5244, longitude: 3.3792 }).expect(400);
    expect(res.body.code).toBe('OUTSIDE_FCT');
    expect(uploadFiles().length).toBe(before);
  });
});

describe('TC-REP-03 Duplicate check', () => {
  // ~80 m north of Central Park
  const near = { latitude: 9.05862, longitude: 7.4951 };

  test('a point 80 m from an attraction gets a duplicate warning naming it', async () => {
    const user = await signedInAgent(app);
    const before = uploadFiles().length;
    const res = await send(user, { site_name: 'Park fountain', ...near }).expect(409);
    expect(res.body.code).toBe('DUPLICATE');
    expect(res.body.nearby).toEqual(expect.objectContaining({ kind: 'attraction', id: parkId, name: 'Central Park' }));
    expect(res.body.nearby.distance_m).toBeGreaterThan(70);
    expect(res.body.nearby.distance_m).toBeLessThan(90);
    expect(uploadFiles().length).toBe(before);
  });

  test('ticking "this is a different place" saves it, with the nearest place recorded', async () => {
    const user = await signedInAgent(app);
    const res = await send(user, { site_name: 'Park fountain', ...near, different_place: 'true' }).expect(201);
    const [[row]] = await pool.execute('SELECT nearest_attraction_id, nearest_distance_m FROM Site_Reports WHERE report_id = ?', [res.body.report.report_id]);
    expect(row.nearest_attraction_id).toBe(parkId);
    expect(row.nearest_distance_m).toBeLessThan(90);
  });

  test('an open report nearby also counts as a possible duplicate', async () => {
    const a = await signedInAgent(app);
    const b = await signedInAgent(app);
    await send(a, { site_name: 'Bwari Waterfall', latitude: 9.2800, longitude: 7.3800 }).expect(201);
    const res = await send(b, { site_name: 'Falls near Bwari', latitude: 9.2805, longitude: 7.3802 }).expect(409);
    expect(res.body.nearby).toEqual(expect.objectContaining({ kind: 'report', name: 'Bwari Waterfall' }));
  });
});

describe('My reports', () => {
  test('lists only the user’s own reports, newest first', async () => {
    const user = await signedInAgent(app);
    await send(user, { site_name: 'First', latitude: 8.80, longitude: 7.20 }).expect(201);
    await send(user, { site_name: 'Second', latitude: 8.82, longitude: 7.20 }).expect(201);
    const res = await user.get('/api/reports/mine').expect(200);
    expect(res.body.reports.map((r) => r.site_name)).toEqual(['Second', 'First']);
  });
});

describe('TC-REP-04 Community confirmation', () => {
  let reporter, reportId;
  beforeAll(async () => {
    reporter = await signedInAgent(app);
    const res = await send(reporter, { site_name: 'Kubwa Hill Shrine', category_id: cat['Religious Sites'], latitude: 9.1500, longitude: 7.3300 }).expect(201);
    reportId = res.body.report.report_id;
  });

  test('the reporter cannot confirm their own report, and does not see it in the nearby list', async () => {
    const res = await reporter.post(`/api/reports/${reportId}/responses`).send({ response: 'confirm' }).expect(403);
    expect(res.body.error).toMatch(/own report/);
    const list = await reporter.get('/api/reports/nearby').query({ lat: 9.15, lng: 7.33, radius: 5 }).expect(200);
    expect(list.body.reports.map((r) => r.report_id)).not.toContain(reportId);
  });

  test('three confirmations from other users move it to under review', async () => {
    const users = [await signedInAgent(app), await signedInAgent(app), await signedInAgent(app)];
    const list = await users[0].get('/api/reports/nearby').query({ lat: 9.15, lng: 7.33, radius: 5 }).expect(200);
    expect(list.body.reports.find((r) => r.report_id === reportId)).toEqual(expect.objectContaining({ status: 'pending', my_response: null }));

    const statuses = [];
    for (const u of users) {
      const res = await u.post(`/api/reports/${reportId}/responses`).send({ response: 'confirm' }).expect(201);
      statuses.push(res.body.result.status);
    }
    expect(statuses).toEqual(['pending', 'pending', 'under_review']);
    const [[row]] = await pool.execute('SELECT status, confirm_count FROM Site_Reports WHERE report_id = ?', [reportId]);
    expect(row).toEqual({ status: 'under_review', confirm_count: 3 });

    const again = await users[0].post(`/api/reports/${reportId}/responses`).send({ response: 'confirm' }).expect(409);
    expect(again.body.error).toMatch(/already responded/);
  });

  test('a flag needs a reason', async () => {
    const u = await signedInAgent(app);
    const res = await u.post(`/api/reports/${reportId}/responses`).send({ response: 'flag' }).expect(400);
    expect(res.body.details[0].path).toEqual(['reason']);
  });

  test('three flags with more flags than confirmations hide a report from the public list', async () => {
    const owner = await signedInAgent(app);
    const { body } = await send(owner, { site_name: 'Private compound', latitude: 9.0300, longitude: 7.2500 }).expect(201);
    const id = body.report.report_id;
    const flaggers = [await signedInAgent(app), await signedInAgent(app), await signedInAgent(app)];
    for (const f of flaggers) await f.post(`/api/reports/${id}/responses`).send({ response: 'flag', reason: 'This is a private home.' }).expect(201);
    const [[row]] = await pool.execute('SELECT is_hidden, status FROM Site_Reports WHERE report_id = ?', [id]);
    expect(row).toEqual({ is_hidden: 1, status: 'pending' });
    const viewer = await signedInAgent(app);
    const list = await viewer.get('/api/reports/nearby').query({ lat: 9.03, lng: 7.25, radius: 5 }).expect(200);
    expect(list.body.reports.map((r) => r.report_id)).not.toContain(id);
  });
});

describe('TC-REP-05 Admin review and publication', () => {
  let admin, reporter;
  beforeAll(async () => {
    admin = await signedInAgent(app, { role: 'admin' });
    reporter = await signedInAgent(app);
    await pool.execute("UPDATE Users SET full_name = 'Zainab Musa', display_name = NULL WHERE email LIKE 'tourist-%' ORDER BY user_id DESC LIMIT 1");
  });

  test('tourists cannot use the review queue', async () => {
    await reporter.get('/api/admin/reports').expect(403);
  });

  test('approving publishes the site with the community badge in search and recommendations', async () => {
    const { body } = await send(reporter, { site_name: 'Jiwa Hot Spring', latitude: 9.0100, longitude: 7.4000 }).expect(201);
    const id = body.report.report_id;

    const queue = await admin.get('/api/admin/reports').expect(200);
    expect(queue.body.reports.map((r) => r.report_id)).toContain(id);
    expect(queue.body.counts.pending).toBeGreaterThan(0);

    const res = await admin.patch(`/api/admin/reports/${id}`)
      .send({ action: 'approve', edits: { site_name: 'Jiwa Warm Spring' } }).expect(200);
    expect(res.body.report.status).toBe('approved');
    expect(res.body.report.attraction_id).toEqual(expect.any(Number));
    expect(res.body.report.reviewer_name).toBeTruthy();

    const search = await request(app).get('/api/attractions/nearby').query({ lat: 9.01, lng: 7.40, radius: 2 }).expect(200);
    const found = search.body.attractions.find((a) => a.name === 'Jiwa Warm Spring');
    expect(found).toEqual(expect.objectContaining({ source: 'community' }));

    const recs = await request(app).get('/api/recommendations').query({ lat: 9.01, lng: 7.40, radius: 2 }).expect(200);
    expect(recs.body.attractions.find((a) => a.name === 'Jiwa Warm Spring')).toEqual(expect.objectContaining({ source: 'community' }));

    const details = await request(app).get(`/api/attractions/${found.attraction_id}`).expect(200);
    expect(details.body.attraction.community).toEqual(expect.objectContaining({ contributor: 'Zainab', local_name: 'Ruwan Dutse' }));
    expect(details.body.attraction.photos).toEqual(body.report.photo_urls);

    const mine = await reporter.get('/api/reports/mine').expect(200);
    expect(mine.body.reports.find((r) => r.report_id === id)).toEqual(expect.objectContaining({ status: 'approved', attraction_id: found.attraction_id }));

    await admin.patch(`/api/admin/reports/${id}`).send({ action: 'reject', note: 'Changed my mind' }).expect(409);
  });

  test('if approval fails part-way, nothing is saved', async () => {
    const { body } = await send(reporter, { site_name: 'Gurara Viewpoint', latitude: 8.9000, longitude: 7.3000 }).expect(201);
    const id = body.report.report_id;
    await admin.patch(`/api/admin/reports/${id}`).send({ action: 'approve', edits: { category_id: 9999 } }).expect(400);
    const [[r]] = await pool.execute('SELECT status, reviewed_at FROM Site_Reports WHERE report_id = ?', [id]);
    expect(r).toEqual({ status: 'pending', reviewed_at: null });
    const [rows] = await pool.execute('SELECT attraction_id FROM Attractions WHERE report_id = ?', [id]);
    expect(rows).toHaveLength(0);
  });

  test('rejecting needs a reason, which the reporter sees', async () => {
    const { body } = await send(reporter, { site_name: 'My uncle’s farm', latitude: 8.7000, longitude: 7.0000 }).expect(201);
    const id = body.report.report_id;
    await admin.patch(`/api/admin/reports/${id}`).send({ action: 'reject' }).expect(400);
    await admin.patch(`/api/admin/reports/${id}`).send({ action: 'reject', note: 'Private land, not open to visitors.' }).expect(200);
    const mine = await reporter.get('/api/reports/mine').expect(200);
    expect(mine.body.reports.find((r) => r.report_id === id)).toEqual(expect.objectContaining({ status: 'rejected', review_note: 'Private land, not open to visitors.' }));
  });

  test('"request more information" lets the reporter update the report, which goes back to pending', async () => {
    const { body } = await send(reporter, { site_name: 'Old Gwagwa Well', latitude: 9.0800, longitude: 7.2800 }).expect(201);
    const id = body.report.report_id;
    const update = { description: 'Hand-dug well from the 1950s beside the old Gwagwa market square, still in use.', access_notes: 'Ask at the market.' };
    await reporter.put(`/api/reports/${id}`).send(update).expect(409); // not asked yet
    await admin.patch(`/api/admin/reports/${id}`).send({ action: 'needs_info', note: 'How old is it, and can visitors reach it?' }).expect(200);
    const res = await reporter.put(`/api/reports/${id}`).send(update).expect(200);
    expect(res.body.report).toEqual(expect.objectContaining({ status: 'pending', access_notes: 'Ask at the market.' }));

    const detail = await admin.get(`/api/admin/reports/${id}`).expect(200);
    expect(detail.body.report.description).toBe(update.description);
  });

  test('the admin view shows each response with its reason', async () => {
    const owner = await signedInAgent(app);
    const { body } = await send(owner, { site_name: 'Dutse Rock Art', latitude: 9.1900, longitude: 7.3500 }).expect(201);
    const id = body.report.report_id;
    const f = await signedInAgent(app);
    await f.post(`/api/reports/${id}/responses`).send({ response: 'flag', reason: 'Wrong location' }).expect(201);
    const res = await admin.get(`/api/admin/reports/${id}`).expect(200);
    expect(res.body.report.responses).toEqual([expect.objectContaining({ response: 'flag', reason: 'Wrong location' })]);
    expect(res.body.report.flag_count).toBe(1);
  });
});
