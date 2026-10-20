/**
 * Jest reporter that turns a test run into Chapter 4 evidence:
 *   evaluation/results/test-results.csv   every test, its suite, result and time
 *   evaluation/results/table-3-14.md      Table 3.14 with the actual result of each test case
 * Used by `npm run test:report`.
 */
const fs = require('fs');
const path = require('path');

// Table 3.14 (Chapter 3), copied so the results table can sit beside the plan.
const TABLE = [
  ['TC-AUTH-01', 'User registration', 'Unregistered email; valid details', 'Account created; bcrypt hash saved'],
  ['TC-ADM-01', 'Attraction management', 'Admin logged in; new attraction details', 'Attraction created and visible in search'],
  ['TC-SEARCH-01', 'Location radius', 'User GPS active; radiusKm = 10', 'Returns only POIs within 10 km'],
  ['TC-REC-01', 'Scoring engine', 'Preferences set; category = Park', 'Matching-category POIs score higher'],
  ['TC-NAV-01', 'Navigation hand-off', 'POI selected; click "Get Directions"', 'External Google Maps route opens'],
  ['TC-REP-01', 'Report submission', 'User logged in; valid report with 2 photos', 'Report saved with status "pending"'],
  ['TC-REP-02', 'Boundary check', 'User logged in; coordinates in Lagos', 'Report rejected: outside FCT'],
  ['TC-REP-03', 'Duplicate detection', 'Attraction exists; report 80 m away', 'Duplicate warning shows the existing attraction'],
  ['TC-REP-04', 'Community corroboration', 'Pending report; 3 other users confirm', 'Status becomes under_review; reporter cannot confirm own report'],
  ['TC-REP-05', 'Approval and publication', 'Report under review; admin approves', 'New community attraction appears in search and recommendations'],
  ['TC-PERF-01', 'Response time', 'Seeded database; 50 API calls', 'Mean response time under 2.0 s (see perf-summary.md)'],
];

const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

class Table314Reporter {
  constructor(globalConfig) {
    this.rootDir = globalConfig.rootDir;
  }

  onRunComplete(contexts, results) {
    const outDir = path.join(this.rootDir, 'evaluation', 'results');
    fs.mkdirSync(outDir, { recursive: true });
    const rows = [];
    for (const file of results.testResults) {
      for (const t of file.testResults) {
        const id = (t.ancestorTitles.join(' ').match(/TC-[A-Z]+-\d+/) || [''])[0];
        rows.push({
          test_case: id,
          file: path.relative(this.rootDir, file.testFilePath),
          suite: t.ancestorTitles.join(' › '),
          test: t.title,
          status: t.status,
          ms: t.duration ?? '',
        });
      }
    }
    const header = ['test_case', 'file', 'suite', 'test', 'status', 'ms'];
    fs.writeFileSync(path.join(outDir, 'test-results.csv'), [header.join(','), ...rows.map((r) => header.map((h) => csv(r[h])).join(','))].join('\n') + '\n');

    const when = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const lines = [
      `# Table 3.14 results`,
      '',
      `Run on ${when} UTC with Jest + Supertest against the separate \`smart_tourism_test\` database.`,
      `${results.numPassedTests} of ${results.numTotalTests} automated tests passed in ${results.numTotalTestSuites} suites.`,
      '',
      '| Test case | Feature | Input | Expected outcome | Tests | Result |',
      '| --- | --- | --- | --- | --- | --- |',
    ];
    for (const [id, feature, input, expected] of TABLE) {
      const mine = rows.filter((r) => r.test_case === id);
      let result;
      if (id === 'TC-PERF-01') result = 'Run `npm run eval:perf`';
      else if (!mine.length) result = 'Not run';
      else result = mine.every((r) => r.status === 'passed') ? 'Pass' : `Fail (${mine.filter((r) => r.status !== 'passed').length} failing)`;
      lines.push(`| ${id} | ${feature} | ${input} | ${expected} | ${mine.length || '–'} | ${result} |`);
    }
    lines.push('', '## Other automated tests', '', '| Suite | Tests | Passed |', '| --- | --- | --- |');
    const others = new Map();
    for (const r of rows.filter((x) => !x.test_case)) {
      const key = r.suite.split(' › ')[0];
      const o = others.get(key) || { n: 0, p: 0 };
      o.n += 1; o.p += r.status === 'passed' ? 1 : 0;
      others.set(key, o);
    }
    for (const [k, o] of others) lines.push(`| ${k} | ${o.n} | ${o.p} |`);
    fs.writeFileSync(path.join(outDir, 'table-3-14.md'), lines.join('\n') + '\n');
    console.log(`\nTable 3.14 results written to ${path.relative(process.cwd(), path.join(outDir, 'table-3-14.md'))}`);
  }
}

module.exports = Table314Reporter;
