const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const request = require('supertest');
const app = require('../../src/app');
const env = require('../../src/config/env');
const { pool } = require('../../src/config/db');
const { resetDb, signedInAgent } = require('../helpers/db');
const { truncateOldSearchCoordinates } = require('../../src/jobs/privacy');

beforeAll(() => resetDb());
afterAll(() => pool.end());

describe('Security headers, CORS and request limits (Section 3.8.1)', () => {
  test('helmet security headers are set and the framework is not advertised', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('only the web app’s own address may call the API from a browser', async () => {
    const ok = await request(app).get('/api/health').set('Origin', env.clientOrigin).expect(200);
    expect(ok.headers['access-control-allow-origin']).toBe(env.clientOrigin);
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const evil = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('request bodies over 100 KB are refused', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(120 * 1024) }).expect(413);
    expect(res.body.error).toMatch(/too large/);
  });

  test('the session cookie is httpOnly and SameSite=Strict', async () => {
    await request(app).post('/api/auth/register').send({ full_name: 'Cookie Check', email: 'cookie@example.com', password: 'Password@123' }).expect(201);
    const res = await request(app).post('/api/auth/login').send({ email: 'cookie@example.com', password: 'Password@123' }).expect(200);
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('token='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
  });

  test('production refuses to start with a weak JWT secret or a non-https web address', () => {
    const run = (vars) => execFileSync(process.execPath, ['-e', "require('./src/config/env')"], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, NODE_ENV: 'production', DB_USER: 'x', DB_NAME: 'x', ...vars },
      stdio: 'pipe',
    });
    expect(() => run({ JWT_SECRET: 'short', CLIENT_ORIGIN: 'https://app.example' })).toThrow(/JWT_SECRET/);
    expect(() => run({ JWT_SECRET: 'k'.repeat(48), CLIENT_ORIGIN: 'http://app.example' })).toThrow(/CLIENT_ORIGIN/);
    expect(() => run({ JWT_SECRET: 'k'.repeat(48), CLIENT_ORIGIN: 'https://app.example' })).not.toThrow();
  });
});

describe('SQL injection defence (Section 3.8.1)', () => {
  test('injection strings in inputs are treated as data, never as SQL', async () => {
    await pool.execute("INSERT INTO Attractions (name, category_id, latitude, longitude) VALUES ('Real Place', 1, 9.06, 7.49)");
    await request(app).get('/api/attractions/nearby').query({ lat: 9.06, lng: 7.49, category: '1 OR 1=1' }).expect(400);
    await request(app).post('/api/auth/login').send({ email: "' OR '1'='1", password: "' OR '1'='1" }).expect(400);
    await request(app).post('/api/auth/login').send({ email: "admin@x.com' -- ", password: 'anything' }).expect(400);
    const admin = await signedInAgent(app, { role: 'admin' });
    const res = await admin.get('/api/admin/attractions').query({ q: "%' OR 1=1 -- " }).expect(200);
    expect(res.body.attractions).toEqual([]);
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM Attractions');
    expect(n).toBe(1); // nothing dropped or added
  });

  /**
   * Every query uses ? placeholders for values. The only ${…} inside SQL text are the fixed fragments below,
   * which never contain user input. A new interpolation fails this test until someone reviews it and adds it here.
   */
  test('the only text pasted into SQL is a reviewed list of fixed fragments', () => {
    const REVIEWED = new Set([
      'SELECT_COLUMNS', 'OWN_COLUMNS', 'ADMIN_COLUMNS', 'ADMIN_FROM', // fixed column lists and joins
      'where', // built only from fixed fragments with ? placeholders (reports.adminList)
      "OPEN.map(() => '?').join(',')", // a list of ? placeholders
      'includeInactive ? \'\' : "AND a.status = \'active\'"', // fixed fragment chosen by a boolean
      'since', "localDay('searched_at')", 'RECS', // fixed SQL in analytics; the day count is a ? value
    ]);
    const files = [];
    (function walk(d) {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p);
      }
    })(path.join(__dirname, '../../src'));
    const found = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/`([^`]*)`/g)) {
        if (!/\b(SELECT|INSERT|UPDATE|DELETE|WHERE|FROM)\b/.test(m[1])) continue;
        for (const e of m[1].matchAll(/\$\{([^}]*)\}/g)) found.push({ file: path.basename(f), expr: e[1].trim() });
      }
    }
    const unreviewed = found.filter((x) => !REVIEWED.has(x.expr));
    expect(unreviewed).toEqual([]);
    expect(found.length).toBeGreaterThan(0);
  });
});

describe('Location privacy (Section 3.8.2)', () => {
  test('search coordinates older than 30 days are rounded to 2 decimal places; newer ones are kept', async () => {
    await pool.query('DELETE FROM Search_Logs');
    await pool.execute("INSERT INTO Search_Logs (latitude, longitude, searched_at) VALUES (9.057912, 7.495134, UTC_TIMESTAMP() - INTERVAL 31 DAY)");
    await pool.execute("INSERT INTO Search_Logs (latitude, longitude, searched_at) VALUES (9.061234, 7.481234, UTC_TIMESTAMP() - INTERVAL 29 DAY)");
    expect(await truncateOldSearchCoordinates(30)).toBe(1);
    const [rows] = await pool.query('SELECT latitude, longitude FROM Search_Logs ORDER BY searched_at');
    expect(rows).toEqual([{ latitude: 9.06, longitude: 7.5 }, { latitude: 9.061234, longitude: 7.481234 }]);
    expect(await truncateOldSearchCoordinates(30)).toBe(0); // safe to run again
  });

  test('the public only ever sees a contributor’s display name, never their full name or email', async () => {
    const reporter = await signedInAgent(app, { email: 'halima.private@example.com' });
    await pool.execute("UPDATE Users SET full_name = 'Halima Bello Sani', display_name = 'Mama Halima' WHERE email = 'halima.private@example.com'");
    const [[u]] = await pool.query("SELECT user_id FROM Users WHERE email = 'halima.private@example.com'");
    const [r] = await pool.execute(
      `INSERT INTO Site_Reports (reporter_id, category_id, site_name, description, latitude, longitude, photo_urls, public_access, status, reviewed_at)
       VALUES (?, 1, 'Quiet Hill', 'A small hill with a view of the city.', 9.1, 7.4, '[]', TRUE, 'approved', UTC_TIMESTAMP())`, [u.user_id]);
    const [a] = await pool.execute("INSERT INTO Attractions (name, category_id, latitude, longitude, source, report_id) VALUES ('Quiet Hill', 1, 9.1, 7.4, 'community', ?)", [r.insertId]);
    await reporter.post(`/api/attractions/${a.insertId}/reviews`).send({ rating: 5 }).expect(201);

    const details = await request(app).get(`/api/attractions/${a.insertId}`).expect(200);
    const reviews = await request(app).get(`/api/attractions/${a.insertId}/reviews`).expect(200);
    expect(details.body.attraction.community.contributor).toBe('Mama Halima');
    expect(reviews.body.reviews[0].author).toBe('Mama Halima');
    const publicText = JSON.stringify([details.body, reviews.body]);
    expect(publicText).not.toMatch(/Bello|Sani|halima\.private|@example/);
  });
});
