const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');
const { resetDb } = require('../helpers/db');

const amina = { full_name: 'Amina Bello', email: 'Amina@Example.com', password: 'Tourist@123' };

beforeAll(resetDb);
afterAll(() => pool.end());

describe('TC-AUTH-01 User registration', () => {
  test('creates the account, stores a bcrypt hash and signs the user in', async () => {
    const res = await request(app).post('/api/auth/register').send(amina);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'amina@example.com', display_name: 'Amina', role: 'tourist' });
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/token=.+; .*HttpOnly/i);
    expect(res.headers['set-cookie'][0]).toMatch(/SameSite=Strict/i);

    const [[row]] = await pool.execute('SELECT password_hash FROM Users WHERE email = ?', ['amina@example.com']);
    expect(row.password_hash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, cost 12
    expect(row.password_hash).not.toContain(amina.password);
  });

  test('refuses a second account with the same email (any letter case)', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...amina, email: 'AMINA@example.com' });
    expect(res.status).toBe(409);
  });

  test('rejects weak input with field details', async () => {
    const res = await request(app).post('/api/auth/register').send({ full_name: 'A', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.path[0]).sort()).toEqual(['email', 'full_name', 'password']);
  });
});

describe('Login, session and logout', () => {
  test('wrong password gives the same message as an unknown email', async () => {
    const wrong = await request(app).post('/api/auth/login').send({ email: amina.email, password: 'Wrong@123' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Wrong@123' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  test('login sets a cookie that /me accepts, and logout clears it', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ email: amina.email, password: amina.password });
    expect(login.status).toBe(200);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('amina@example.com');

    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  test('/me without a cookie, or with a tampered one, is 401', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Cookie', 'token=not.a.real.token').expect(401);
  });
});

describe('FR-02 Category preferences', () => {
  let agent;
  beforeAll(async () => {
    agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: amina.email, password: amina.password }).expect(200);
  });

  test('lists the five categories', async () => {
    const res = await request(app).get('/api/categories').expect(200);
    expect(res.body.categories).toHaveLength(5);
  });

  test('saves, replaces and reads back preferences', async () => {
    const { body } = await request(app).get('/api/categories');
    const [a, b, c] = body.categories.map((x) => x.category_id);

    let res = await agent.put('/api/users/me/preferences').send({ category_ids: [a, b, b] }).expect(200);
    expect(res.body.preferences.map((p) => p.category_id).sort()).toEqual([a, b].sort());

    res = await agent.put('/api/users/me/preferences').send({ category_ids: [c] }).expect(200);
    expect(res.body.preferences.map((p) => p.category_id)).toEqual([c]);

    res = await agent.get('/api/auth/me').expect(200);
    expect(res.body.user.preference_count).toBe(1);
  });

  test('rejects unknown categories and signed-out requests', async () => {
    await agent.put('/api/users/me/preferences').send({ category_ids: [9999] }).expect(400);
    await request(app).put('/api/users/me/preferences').send({ category_ids: [] }).expect(401);
  });
});
