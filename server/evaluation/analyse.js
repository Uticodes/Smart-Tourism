/**
 * Produces the Chapter 4 and 5 evaluation numbers, tables and charts from the exported data.
 *
 *   npm run eval:analyse                              uses evaluation/results/* and evaluation/sus-responses.csv if present
 *   npm run eval:analyse -- --sus ~/Downloads/SUS.csv  a Google Forms export (or the template's q1–q10 layout)
 *
 * Inputs (in evaluation/results/, from `npm run eval:perf` and `npm run eval:export`):
 *   perf-summary.json, mrr-lists.csv, pilot-reports.csv, duplicate-warnings.csv
 * Outputs (evaluation/results/):
 *   evaluation-results.md    tables and figure captions to copy into the report
 *   evaluation-results.json  every number, for checking
 *   sus-scores.csv           each participant's SUS score
 *   charts/*.png, *.svg      figures (PNG at 2× for Word)
 */
const fs = require('fs');
const path = require('path');
const { parse, stringify } = require('./lib/csv');
const S = require('./lib/stats');
const { barChart, columnChart, save } = require('./lib/charts');

const DIR = path.join(__dirname, 'results');
const CHARTS = path.join(DIR, 'charts');
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};
const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
const r2 = (x) => (x == null || Number.isNaN(x) ? null : Math.round(x * 100) / 100);
const pct = (x) => (x == null ? '–' : `${Math.round(x * 1000) / 10}%`);
const fmt = (x, d = 2) => (x == null ? '–' : Number(x).toFixed(d));

/** Picks the ten SUS answer columns: q1–q10 if present, otherwise the first ten columns whose answers are all 1–5. */
function susColumns(header, rows) {
  const named = Array.from({ length: 10 }, (_, i) => header.find((h) => h.trim().toLowerCase() === `q${i + 1}`));
  if (named.every(Boolean)) return named;
  const isScale = (h) => {
    const vals = rows.map((r) => String(r[h]).trim()).filter(Boolean);
    return vals.length > 0 && vals.every((v) => /^[1-5](\D|$)/.test(v));
  };
  const cols = header.filter(isScale).slice(0, 10);
  if (cols.length < 10) throw new Error(`Found ${cols.length} answer columns with values 1–5; the SUS needs 10.`);
  return cols;
}

async function main() {
  fs.mkdirSync(CHARTS, { recursive: true });
  const out = { generated_at: new Date().toISOString() };
  const md = ['# Evaluation results', '', `Generated ${out.generated_at.slice(0, 16).replace('T', ' ')} UTC by \`npm run eval:analyse\`.`, ''];

  // ---------------------------------------------------------------- 1. Response time (TC-PERF-01)
  const perfText = read(path.join(DIR, 'perf-summary.json'));
  if (perfText) {
    const p = JSON.parse(perfText);
    out.performance = p;
    md.push('## 1. Response time (TC-PERF-01)', '',
      `Target: mean under ${p.target_ms / 1000} s per endpoint. **Result: ${p.pass ? 'met' : 'not met'}.**`, '',
      '| Endpoint | Calls | Mean (ms) | SD | Median | 95th percentile | Max |', '| --- | --- | --- | --- | --- | --- | --- |',
      ...p.endpoints.map((e) => `| ${e.endpoint} | ${e.n} | ${Math.round(e.mean)} | ${Math.round(e.sd)} | ${Math.round(e.median)} | ${Math.round(e.p95)} | ${Math.round(e.max)} |`),
      '', `Conditions: ${p.environment.iterations} Newman iterations; ${p.environment.machine}; MySQL ${p.environment.mysql}; ${p.environment.attractions} attractions; ${p.environment.photo_mb} MB photo per report.`,
      '', '*Figure: charts/response-time.png*', '');
    await save(barChart({
      title: 'Mean response time by endpoint',
      subtitle: `${p.environment.iterations} calls each; bar = mean, label also gives the 95th percentile`,
      items: p.endpoints.map((e) => ({ label: e.endpoint, value: Math.round(e.mean), display: `${Math.round(e.mean)} ms (95th: ${Math.round(e.p95)} ms)` })),
      unit: '', ref: { value: p.target_ms, label: '2.0 s target' }, max: p.target_ms * 1.05,
      note: 'Milliseconds, measured by Newman on the test machine (no internet latency).',
    }), path.join(CHARTS, 'response-time'));
  } else md.push('## 1. Response time (TC-PERF-01)', '', '_Not run yet: `npm run eval:perf`._', '');

  // ---------------------------------------------------------------- 2. Recommendation accuracy (MRR)
  const mrrText = read(path.join(DIR, 'mrr-lists.csv'));
  if (mrrText) {
    const lists = parse(mrrText).rows;
    const ranks = lists.map((r) => Number(r.selected_rank)).filter((x) => x >= 1);
    const bucket = (r) => (r >= 6 ? '6+' : String(r));
    const dist = ['1', '2', '3', '4', '5', '6+'].map((k) => ({ rank: k, count: ranks.filter((r) => bucket(r) === k).length }));
    const signedIn = lists.filter((r) => r.signed_in === 'yes' && Number(r.selected_rank) >= 1).map((r) => Number(r.selected_rank));
    const guests = lists.filter((r) => r.signed_in !== 'yes' && Number(r.selected_rank) >= 1).map((r) => Number(r.selected_rank));
    out.mrr = {
      lists_shown: lists.length,
      lists_with_selection: ranks.length,
      selection_rate: lists.length ? ranks.length / lists.length : null,
      mrr: S.mrr(ranks),
      hit_at_1: ranks.length ? ranks.filter((r) => r === 1).length / ranks.length : null,
      hit_at_3: ranks.length ? ranks.filter((r) => r <= 3).length / ranks.length : null,
      mrr_signed_in: S.mrr(signedIn),
      mrr_guests: S.mrr(guests),
      rank_distribution: dist,
    };
    const m = out.mrr;
    md.push('## 2. Recommendation accuracy (MRR)', '',
      'MRR = (1 ÷ |Q|) × Σ 1 ÷ rank_i, over the |Q| recommendation lists in which the participant opened a place (Section 3.8.3).', '',
      '| Measure | Value |', '| --- | --- |',
      `| Recommendation lists shown | ${m.lists_shown} |`,
      `| Lists where a place was opened (\\|Q\\|) | ${m.lists_with_selection} (${pct(m.selection_rate)}) |`,
      `| **Mean Reciprocal Rank** | **${fmt(m.mrr, 3)}** |`,
      `| Opened the 1st result (Hit@1) | ${pct(m.hit_at_1)} |`,
      `| Opened one of the top 3 (Hit@3) | ${pct(m.hit_at_3)} |`,
      `| MRR, signed-in (personalised) | ${fmt(m.mrr_signed_in, 3)} (n = ${signedIn.length}) |`,
      `| MRR, guests (rating and distance only) | ${fmt(m.mrr_guests, 3)} (n = ${guests.length}) |`,
      '', '*Figure: charts/mrr-rank-distribution.png*', '');
    await save(columnChart({
      title: 'Position of the place opened from the recommendations',
      subtitle: `MRR = ${fmt(m.mrr, 3)} over ${m.lists_with_selection} lists; more at position 1 means better ranking`,
      items: dist.map((d) => ({ label: d.rank === '6+' ? '6th+' : `${d.rank}${['st', 'nd', 'rd'][Number(d.rank) - 1] || 'th'}`, value: d.count })),
      yLabel: 'Lists',
    }), path.join(CHARTS, 'mrr-rank-distribution'));
  } else md.push('## 2. Recommendation accuracy (MRR)', '', '_No export yet: `npm run eval:export`._', '');

  // ---------------------------------------------------------------- 3. Crowdsourcing pilot
  const pilotText = read(path.join(DIR, 'pilot-reports.csv'));
  if (pilotText) {
    const reps = parse(pilotText).rows;
    const warnings = parse(read(path.join(DIR, 'duplicate-warnings.csv')) || 'shown_at_abuja\n').rows;
    const n = (f) => reps.filter(f).length;
    const decidedHours = reps.filter((r) => r.hours_to_decision !== '').map((r) => Number(r.hours_to_decision));
    const approved = n((r) => r.status === 'approved');
    const rejected = n((r) => r.status === 'rejected');
    out.pilot = {
      reports_submitted: reps.length,
      approved,
      rejected,
      still_open: n((r) => ['pending', 'under_review', 'needs_info'].includes(r.status)),
      reached_three_confirmations: n((r) => Number(r.confirmations) >= 3),
      hidden_by_flags: n((r) => r.hidden_by_flags === 'yes'),
      duplicates_caught: warnings.length,
      sent_after_duplicate_warning: n((r) => r.sent_after_duplicate_warning === 'yes'),
      approval_rate_of_submitted: reps.length ? approved / reps.length : null,
      approval_rate_of_decided: approved + rejected ? approved / (approved + rejected) : null,
      mean_hours_to_decision: decidedHours.length ? S.mean(decidedHours) : null,
      median_hours_to_decision: decidedHours.length ? S.median(decidedHours) : null,
    };
    const p = out.pilot;
    md.push('## 3. Crowdsourcing pilot', '',
      '| Measure (Section 3.8.3) | Value |', '| --- | --- |',
      `| Reports submitted | ${p.reports_submitted} |`,
      `| Duplicates caught automatically (150 m warning) | ${p.duplicates_caught} |`,
      `| Sent anyway as a different place | ${p.sent_after_duplicate_warning} |`,
      `| Reached 3 community confirmations | ${p.reached_three_confirmations} |`,
      `| Hidden by community flags | ${p.hidden_by_flags} |`,
      `| Approved | ${p.approved} |`,
      `| Not approved | ${p.rejected} |`,
      `| Still open at export | ${p.still_open} |`,
      `| **Approval rate (approved ÷ submitted)** | **${pct(p.approval_rate_of_submitted)}** |`,
      `| Approval rate of decided reports | ${pct(p.approval_rate_of_decided)} |`,
      `| **Mean time to decision** | **${p.mean_hours_to_decision == null ? '–' : `${fmt(p.mean_hours_to_decision, 1)} h`}** (median ${p.median_hours_to_decision == null ? '–' : `${fmt(p.median_hours_to_decision, 1)} h`}) |`,
      '', '*Figure: charts/pilot-pipeline.png*', '');
    await save(barChart({
      title: 'Crowdsourced reports during the pilot',
      subtitle: 'From duplicate warning to administrator decision',
      items: [
        { label: 'Duplicates caught', value: p.duplicates_caught },
        { label: 'Reports submitted', value: p.reports_submitted },
        { label: 'Reached 3 confirmations', value: p.reached_three_confirmations },
        { label: 'Approved', value: p.approved },
        { label: 'Not approved', value: p.rejected },
      ],
      labelWidth: 210,
    }), path.join(CHARTS, 'pilot-pipeline'));
  } else md.push('## 3. Crowdsourcing pilot', '', '_No export yet: `npm run eval:export`._', '');

  // ---------------------------------------------------------------- 4. Usability (SUS)
  const susPath = arg('sus') || path.join(__dirname, 'sus-responses.csv');
  const susText = read(susPath);
  if (susText) {
    const { header, rows } = parse(susText);
    const cols = susColumns(header, rows);
    const idCol = header.find((h) => /^(participant|id)$/i.test(h.trim()));
    const groupCol = header.find((h) => /^group$/i.test(h.trim()));
    const people = [];
    const skipped = [];
    rows.forEach((r, i) => {
      const answers = cols.map((c) => Number(String(r[c]).trim().charAt(0)));
      const id = (idCol && r[idCol]) || `P${String(i + 1).padStart(2, '0')}`;
      try {
        people.push({ participant: id, group: groupCol ? r[groupCol] : '', answers, score: S.susScore(answers) });
      } catch {
        skipped.push(id);
      }
    });
    if (!people.length) throw new Error(`No complete SUS responses in ${susPath}.`);
    const scores = people.map((p) => p.score);
    const test = S.oneSampleT(scores, 68);
    const groups = [...new Set(people.map((p) => p.group).filter(Boolean))];
    out.sus = {
      file: susPath,
      columns_used: cols,
      n: people.length,
      skipped_incomplete: skipped,
      mean: test.mean, sd: test.sd, median: S.median(scores), min: Math.min(...scores), max: Math.max(...scores),
      ci95: test.ci95,
      above_68: scores.filter((s) => s > 68).length,
      acceptability: ['Acceptable', 'Marginal', 'Not acceptable'].map((a) => ({ range: a, count: scores.filter((s) => S.susAcceptability(s) === a).length })),
      t_test_vs_68: { t: test.t, df: test.df, p_one_sided: test.p_one_sided },
      by_group: groups.map((g) => {
        const gs = people.filter((p) => p.group === g).map((p) => p.score);
        return { group: g, n: gs.length, mean: S.mean(gs), sd: S.sd(gs) };
      }),
      item_means: cols.map((c, i) => ({ item: i + 1, mean: S.mean(people.map((p) => p.answers[i])) })),
    };
    fs.writeFileSync(path.join(DIR, 'sus-scores.csv'), stringify(['participant', 'group', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'sus_score'],
      people.map((p) => ({ participant: p.participant, group: p.group, ...Object.fromEntries(p.answers.map((a, i) => [`q${i + 1}`, a])), sus_score: p.score }))));
    const s = out.sus;
    const pTxt = s.t_test_vs_68.p_one_sided < 0.001 ? 'p < .001' : `p = ${s.t_test_vs_68.p_one_sided.toFixed(3).replace(/^0/, '')}`;
    md.push('## 4. Usability (System Usability Scale)', '',
      `N = ${s.n} complete responses${skipped.length ? ` (${skipped.length} incomplete skipped: ${skipped.join(', ')})` : ''}. Scored per Brooke (1996); benchmark 68 (Bangor, Kortum & Miller, 2008).`, '',
      '| Measure | Value |', '| --- | --- |',
      `| **Mean SUS score** | **${fmt(s.mean, 1)}** (SD ${fmt(s.sd, 1)}) |`,
      `| 95% confidence interval | ${fmt(s.ci95[0], 1)} to ${fmt(s.ci95[1], 1)} |`,
      `| Median (min–max) | ${fmt(s.median, 1)} (${s.min}–${s.max}) |`,
      `| Participants above 68 | ${s.above_68} of ${s.n} (${pct(s.above_68 / s.n)}) |`,
      `| One-sample t-test, mean > 68 | t(${s.t_test_vs_68.df}) = ${fmt(s.t_test_vs_68.t, 2)}, ${pTxt} (one-sided) |`,
      ...s.acceptability.map((a) => `| ${a.range} (Bangor et al., 2008) | ${a.count} |`),
      '', ...(groups.length ? ['| Group | n | Mean | SD |', '| --- | --- | --- | --- |', ...s.by_group.map((g) => `| ${g.group} | ${g.n} | ${fmt(g.mean, 1)} | ${fmt(g.sd, 1)} |`), ''] : []),
      '| Item | Mean answer (1–5) |', '| --- | --- |', ...s.item_means.map((it) => `| Q${it.item} ${it.item % 2 ? '(positive)' : '(negative)'} | ${fmt(it.mean, 2)} |`),
      '', '*Figure: charts/sus-distribution.png*', '');
    const bins = Array.from({ length: 10 }, (_, i) => ({ lo: i * 10, hi: i === 9 ? 100 : i * 10 + 9.99 }));
    await save(columnChart({
      title: 'Distribution of SUS scores',
      subtitle: `N = ${s.n}, mean ${fmt(s.mean, 1)}; dashed lines mark the mean and the benchmark of 68`,
      items: bins.map((b) => ({ label: `${b.lo}–${b.lo === 90 ? 100 : b.lo + 9}`, value: scores.filter((x) => x >= b.lo && x <= b.hi).length })),
      refs: [
        { at: 68 / 10, label: 'Benchmark 68', anchor: s.mean >= 68 ? 'end' : 'start' },
        { at: Math.min(9.99, s.mean / 10), label: `Mean ${fmt(s.mean, 1)}`, anchor: s.mean >= 68 ? 'start' : 'end' },
      ],
      yLabel: 'Participants',
    }), path.join(CHARTS, 'sus-distribution'));
  } else {
    md.push('## 4. Usability (System Usability Scale)', '', `_No responses yet. Fill \`evaluation/sus-responses.template.csv\` or pass a Google Forms export with \`--sus <file>\`._`, '');
  }

  fs.writeFileSync(path.join(DIR, 'evaluation-results.md'), md.join('\n'));
  fs.writeFileSync(path.join(DIR, 'evaluation-results.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(md.join('\n'));
  console.log(`\nWrote evaluation/results/evaluation-results.md, evaluation-results.json and charts/.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
