/**
 * TC-PERF-01 (Section 3.8.3): mean response time under 2.0 s for search, recommendations and report submission.
 *
 *   npm run eval:perf                 50 iterations (50 calls per endpoint, 150 in total)
 *   npm run eval:perf -- --iterations 100
 *
 * It never touches your real data. It:
 *   1. rebuilds the TEST database (smart_tourism_test) and loads the same seed data as `npm run db:setup`,
 *   2. starts its own copy of the API on a free port,
 *   3. signs in as a seeded tourist with saved interests,
 *   4. runs the Postman collection with Newman, and
 *   5. writes evaluation/results/perf-timings.csv and perf-summary.md.
 * Each report carries a realistic phone-sized photo (about 2 MB), so the time includes re-encoding it.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'evaluation/results');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const ITERATIONS = Number(arg('iterations', 50));
const TARGET_MS = 2000;

// Point everything at the test database and throwaway folders BEFORE the app is loaded.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'discover-abuja-perf-'));
process.env.DB_NAME = process.env.TEST_DB_NAME || 'smart_tourism_test';
process.env.NODE_ENV = 'test';               // quiet logs, relaxed sign-in limit
process.env.REPORT_DAILY_LIMIT = '100000';  // the 5-a-day rule would stop the test after 5 reports
process.env.UPLOAD_DIR = path.join(TMP, 'uploads');
process.env.EVENT_LOG_DIR = path.join(TMP, 'logs');
if (!process.env.DB_NAME.endsWith('_test')) throw new Error('The performance test only runs against a *_test database.');

const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const q = (p) => s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / (s.length - 1 || 1));
  return { n: s.length, mean, sd, min: s[0], median: q(0.5), p95: q(0.95), max: s[s.length - 1] };
};

async function main() {
  console.log(`Rebuilding ${process.env.DB_NAME} with the seed data…`);
  execFileSync(process.execPath, [path.join(ROOT, 'db/setup.js')], { env: process.env, stdio: 'inherit' });

  const newman = require('newman');
  const sharp = require('sharp');
  const app = require(path.join(ROOT, 'src/app'));
  const { pool } = require(path.join(ROOT, 'src/config/db'));

  // A tourist with two saved interests, so recommendations are personalised as in real use.
  await pool.query(`INSERT INTO User_Preferences (user_id, category_id)
                    SELECT u.user_id, c.category_id FROM Users u JOIN Categories c
                     WHERE u.email = 'amina@smarttourism.test' AND c.category_name IN ('Parks & Nature', 'Arts & Culture')`);
  const [[{ attractions }]] = await pool.query("SELECT COUNT(*) AS attractions FROM Attractions WHERE status = 'active'");
  const [[{ version: mysqlVersion }]] = await pool.query('SELECT VERSION() AS version');

  // A phone-sized photo: 4000 × 3000 px with fine detail, which compresses to roughly 2 MB.
  const photoPath = path.join(TMP, 'photo.jpg');
  const w = 4000, h = 3000, raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i += 3) {
    const x = (i / 3) % w, y = Math.floor(i / 3 / w);
    const n = (Math.sin(x * 0.9) * Math.cos(y * 1.3) * 40) | 0;
    raw[i] = 90 + ((x >> 3) % 60) + n; raw[i + 1] = 120 + ((y >> 4) % 70) - n; raw[i + 2] = 80 + n;
  }
  await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 88 }).toFile(photoPath);
  const photoBytes = fs.statSync(photoPath).size;

  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'amina@smarttourism.test', password: process.env.SEED_USER_PASSWORD || 'Tourist@12345' }),
  });
  if (!login.ok) throw new Error(`Could not sign in the test user (${login.status}).`);
  const authCookie = login.headers.get('set-cookie').split(';')[0];

  const collection = JSON.parse(fs.readFileSync(path.join(__dirname, 'discover-abuja.postman_collection.json'), 'utf8'));
  const rows = [];
  let failures = 0;
  console.log(`Running ${ITERATIONS} iterations × 3 endpoints against ${baseUrl} …`);

  const started = Date.now();
  const summary = await new Promise((resolve, reject) => {
    newman.run({
      collection,
      iterationCount: ITERATIONS,
      envVar: [
        { key: 'baseUrl', value: baseUrl },
        { key: 'authCookie', value: authCookie },
        { key: 'photoPath', value: photoPath },
      ],
      reporters: [],
    }, (err, s) => (err ? reject(err) : resolve(s)))
      .on('request', (err, a) => {
        rows.push({
          iteration: a.cursor.iteration + 1,
          endpoint: a.item.name,
          status: err ? 'ERROR' : a.response.code,
          ms: err ? '' : a.response.responseTime,
          bytes: err ? '' : a.response.responseSize,
        });
        if (rows.length % 30 === 0) process.stdout.write(`  ${rows.length} calls\n`);
      })
      .on('assertion', (err) => { if (err) failures += 1; });
  });
  const wallSeconds = (Date.now() - started) / 1000;
  server.close();
  await pool.end();

  // ---- write results
  fs.mkdirSync(OUT, { recursive: true });
  const header = ['iteration', 'endpoint', 'status', 'ms', 'bytes'];
  fs.writeFileSync(path.join(OUT, 'perf-timings.csv'), [header.join(','), ...rows.map((r) => header.map((k) => csv(r[k])).join(','))].join('\n') + '\n');

  const endpoints = [...new Set(rows.map((r) => r.endpoint))];
  const per = endpoints.map((e) => ({ endpoint: e, ...stats(rows.filter((r) => r.endpoint === e && r.ms !== '').map((r) => Number(r.ms))) }));
  const all = stats(rows.filter((r) => r.ms !== '').map((r) => Number(r.ms)));
  const env = {
    date: new Date().toISOString(),
    machine: `${os.cpus()[0]?.model || 'unknown CPU'} (${os.cpus().length} cores), ${Math.round(os.totalmem() / 2 ** 30)} GB RAM, ${os.type()} ${os.release()}`,
    node: process.version,
    mysql: mysqlVersion,
    newman: require('newman/package.json').version,
    attractions,
    photo_mb: Math.round((photoBytes / 2 ** 20) * 10) / 10,
    iterations: ITERATIONS,
    wall_seconds: Math.round(wallSeconds * 10) / 10,
    assertion_failures: failures,
    non_2xx: rows.filter((r) => !(r.status >= 200 && r.status < 300)).length,
  };
  const pass = per.every((p) => p.mean < TARGET_MS);
  const f = (x) => Math.round(x);
  const md = [
    '# TC-PERF-01 – response time',
    '',
    `**Result: ${pass ? 'PASS' : 'FAIL'}.** Mean response time ${pass ? 'was under' : 'was NOT under'} the 2.0 s target for every endpoint (Section 3.8.3).`,
    '',
    '| Endpoint | Calls | Mean (ms) | SD | Median | 95th percentile | Min | Max | Target met |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...per.map((p) => `| ${p.endpoint} | ${p.n} | ${f(p.mean)} | ${f(p.sd)} | ${f(p.median)} | ${f(p.p95)} | ${f(p.min)} | ${f(p.max)} | ${p.mean < TARGET_MS ? 'Yes' : 'No'} |`),
    `| **All calls** | ${all.n} | ${f(all.mean)} | ${f(all.sd)} | ${f(all.median)} | ${f(all.p95)} | ${f(all.min)} | ${f(all.max)} | ${all.mean < TARGET_MS ? 'Yes' : 'No'} |`,
    '',
    '## Test conditions',
    '',
    `- ${env.date.slice(0, 16).replace('T', ' ')} UTC; ${env.iterations} iterations of the Postman collection run with Newman ${env.newman}.`,
    `- API and MySQL ${env.mysql} on the same machine: ${env.machine}; Node ${env.node}.`,
    `- Seeded database with ${env.attractions} active attractions; requests signed in as a tourist with two saved interests.`,
    `- Each report carried one ${env.photo_mb} MB JPEG photo, re-encoded by the server (EXIF removed).`,
    `- ${env.non_2xx} non-2xx responses; ${env.assertion_failures} failed Postman assertions. Total run time ${env.wall_seconds} s.`,
    '- Times are measured by Newman from request start to the last byte of the response. They do not include internet latency, which a deployed server adds.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'perf-summary.md'), md);
  fs.writeFileSync(path.join(OUT, 'perf-summary.json'), JSON.stringify({ target_ms: TARGET_MS, pass, endpoints: per, all, environment: env }, null, 2) + '\n');
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${md}`);
  console.log('Wrote evaluation/results/perf-timings.csv, perf-summary.md and perf-summary.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
