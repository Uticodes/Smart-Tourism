/**
 * Exports the evaluation data from the database the app is using (DB_NAME in .env) to CSV.
 *
 *   npm run eval:export                                  everything
 *   npm run eval:export -- --from 2026-11-02 --to 2026-11-16   only the user-testing window (Abuja dates, inclusive)
 *
 * Writes to evaluation/results/:
 *   mrr-lists.csv           one row per recommendation list shown, with the rank of the place opened (blank if none)
 *   pilot-reports.csv       one row per site report: status, confirmations, flags, time to decision, duplicate distance
 *   duplicate-warnings.csv  one row per duplicate warning shown (reports stopped before they were saved)
 *
 * No names, emails or coordinates are exported, so the files can go in an appendix.
 */
const fs = require('fs');
const path = require('path');
const { stringify } = require('./lib/csv');
const { pool } = require('../src/config/db');
const env = require('../src/config/env');
const eventLog = require('../src/lib/eventLog');

const OUT = path.join(__dirname, 'results');
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};
const from = arg('from');
const to = arg('to');
for (const d of [from, to]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`Dates must look like 2026-11-02 (got ${d}).`);

// Abuja (UTC+1) calendar dates → UTC instants for the WHERE clauses.
const startUtc = from ? new Date(`${from}T00:00:00+01:00`) : new Date('1970-01-01T00:00:00Z');
const endUtc = to ? new Date(new Date(`${to}T00:00:00+01:00`).getTime() + 86400000) : new Date('2999-01-01T00:00:00Z');
const local = (d) => (d ? new Date(new Date(d).getTime() + 3600000).toISOString().slice(0, 16).replace('T', ' ') : '');
const sqlTime = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const range = [sqlTime(startUtc), sqlTime(endUtc)];

  const [lists] = await pool.execute(
    `SELECT log_id, searched_at, user_id IS NOT NULL AS signed_in, selected_rank
       FROM Search_Logs
      WHERE query_text = 'recommendations' AND searched_at >= ? AND searched_at < ?
      ORDER BY searched_at`,
    range
  );
  fs.writeFileSync(path.join(OUT, 'mrr-lists.csv'), stringify(
    ['list_id', 'shown_at_abuja', 'signed_in', 'selected_rank'],
    lists.map((r) => ({ list_id: r.log_id, shown_at_abuja: local(r.searched_at), signed_in: r.signed_in ? 'yes' : 'no', selected_rank: r.selected_rank ?? '' }))
  ));

  const [reports] = await pool.execute(
    `SELECT r.report_id, c.category_name, r.status, r.submitted_at, r.reviewed_at, r.confirm_count, r.flag_count,
            r.is_hidden, r.nearest_distance_m
       FROM Site_Reports r JOIN Categories c ON c.category_id = r.category_id
      WHERE r.submitted_at >= ? AND r.submitted_at < ?
      ORDER BY r.submitted_at`,
    range
  );
  fs.writeFileSync(path.join(OUT, 'pilot-reports.csv'), stringify(
    ['report_id', 'category', 'status', 'submitted_at_abuja', 'decided_at_abuja', 'hours_to_decision', 'confirmations', 'flags', 'hidden_by_flags', 'nearest_known_place_m', 'sent_after_duplicate_warning'],
    reports.map((r) => {
      const decided = ['approved', 'rejected'].includes(r.status) && r.reviewed_at;
      return {
        report_id: r.report_id,
        category: r.category_name,
        status: r.status,
        submitted_at_abuja: local(r.submitted_at),
        decided_at_abuja: decided ? local(r.reviewed_at) : '',
        hours_to_decision: decided ? ((new Date(r.reviewed_at) - new Date(r.submitted_at)) / 3600000).toFixed(2) : '',
        confirmations: r.confirm_count,
        flags: r.flag_count,
        hidden_by_flags: r.is_hidden ? 'yes' : 'no',
        nearest_known_place_m: r.nearest_distance_m ?? '',
        sent_after_duplicate_warning: r.nearest_distance_m != null && Number(r.nearest_distance_m) <= 150 ? 'yes' : 'no',
      };
    })
  ));

  const warnings = eventLog.read('duplicate-warnings').filter((e) => new Date(e.at) >= startUtc && new Date(e.at) < endUtc);
  fs.writeFileSync(path.join(OUT, 'duplicate-warnings.csv'), stringify(
    ['shown_at_abuja', 'matched', 'distance_m'],
    warnings.map((e) => ({ shown_at_abuja: local(e.at), matched: e.nearest_kind === 'attraction' ? 'existing attraction' : 'another open report', distance_m: e.distance_m }))
  ));

  const opened = lists.filter((r) => r.selected_rank).length;
  console.log(`Database: ${env.db.database}${from || to ? `, ${from || 'start'} to ${to || 'today'} (Abuja)` : ''}`);
  console.log(`  mrr-lists.csv           ${lists.length} recommendation lists, ${opened} with a place opened`);
  console.log(`  pilot-reports.csv       ${reports.length} site reports`);
  console.log(`  duplicate-warnings.csv  ${warnings.length} duplicate warnings`);
  console.log('Next: add the SUS responses and run `npm run eval:analyse -- --sus <file.csv>`.');
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => pool.end());
