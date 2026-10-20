import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../../components/AdminNav.jsx';
import Stars from '../../components/Stars.jsx';
import ChartCard, { DataTable, LineLegend } from '../../components/charts/ChartCard.jsx';
import LineChart from '../../components/charts/LineChart.jsx';
import BarList from '../../components/charts/BarList.jsx';
import StatTile from '../../components/charts/StatTile.jsx';
import { shortDay } from '../../components/charts/scale.js';
import { adminAnalytics } from '../../api/admin.js';
import { errorMessage } from '../../api/client.js';

const RANGES = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['all', 'All time']];

// Validated pair (dataviz validator, light surface): green #0A7A4B + blue #2a78d6, all checks pass.
const SEARCH_SERIES = [
  { key: 'recommendations', label: 'Home recommendations', color: '#0A7A4B' },
  { key: 'explore', label: 'Explore searches', color: '#2a78d6' },
];

const pct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`);
const num = (v) => (v == null ? '–' : v.toLocaleString('en-NG'));

function Ranked({ rows, valueHeader, value, empty }) {
  if (!rows.length) return <p className="rounded-md border border-dashed border-granite-200 px-4 py-6 text-sm text-granite-500">{empty}</p>;
  return (
    <ol className="divide-y divide-granite-100">
      {rows.map((r, i) => (
        <li key={r.attraction_id} className="flex items-center gap-3 py-2.5">
          <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-granite-500">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <Link to={`/attractions/${r.attraction_id}`} className="block truncate font-semibold hover:text-green-700 hover:underline">{r.name}</Link>
            <p className="text-sm text-granite-700">
              {r.category_name}
              {r.source === 'community' && <span className="community-badge ml-2 !py-0.5">Community</span>}
            </p>
          </div>
          <div className="shrink-0 text-right">{value(r)}</div>
        </li>
      ))}
      <li className="sr-only">{valueHeader}</li>
    </ol>
  );
}

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState('30');
  const [state, setState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    adminAnalytics(range)
      .then((data) => !cancelled && setState({ loading: false, error: '', data }))
      .catch((err) => !cancelled && setState((s) => ({ ...s, loading: false, error: errorMessage(err) })));
    return () => { cancelled = true; };
  }, [range]);

  const d = state.data;
  const rangeLabel = RANGES.find(([k]) => k === range)[1].toLowerCase();

  return (
    <section className="mx-auto max-w-6xl overflow-x-clip px-4 py-10 sm:px-6">
      <AdminNav />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Analytics</h1>
          <p className="mt-1 text-granite-700">
            How visitors use the system{d ? `, ${shortDay(d.range.from)} to ${shortDay(d.range.to)} (Abuja time)` : ''}.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-md bg-surface p-1 ring-1 ring-granite-200" role="radiogroup" aria-label="Date range">
          {RANGES.map(([key, label]) => (
            <button key={key} type="button" role="radio" aria-checked={range === key} onClick={() => setRange(key)}
              className={`rounded px-3 py-1.5 text-sm font-semibold ${range === key ? 'bg-granite-900 text-white' : 'text-granite-700 hover:bg-granite-100'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {state.error && <p role="alert" className="mt-4 text-danger">{state.error}</p>}
      {!d && state.loading && <p className="mt-6 text-granite-500">Loading…</p>}

      {d && (
        <div className={`mt-6 space-y-6 transition-opacity ${state.loading ? 'opacity-60' : ''}`} aria-busy={state.loading}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 [&>*]:min-w-0">
            <StatTile className="col-span-2 lg:col-span-1" emphasis label="Mean reciprocal rank" value={d.mrr.value == null ? '–' : d.mrr.value.toFixed(2)}
              sub={d.mrr.lists_with_selection ? `from ${num(d.mrr.lists_with_selection)} opened recommendation ${d.mrr.lists_with_selection === 1 ? 'list' : 'lists'}` : 'No recommendation opened yet'} />
            <StatTile label="Searches" value={num(d.searches.total)} sub={`${num(d.searches.recommendations)} recommendations · ${num(d.searches.explore)} Explore`} />
            <StatTile label="New users" value={num(d.users.new_in_range)} sub={`${num(d.users.total)} tourists in total`} />
            <StatTile label="New reviews" value={num(d.reviews.new_in_range)} sub={`${num(d.reviews.total)} in total`} />
            <StatTile label="Places on the map" value={num(d.attractions.curated + d.attractions.community)} sub={`${num(d.attractions.community)} discovered by the community`} />
          </div>

          <ChartCard
            title="Searches per day"
            description="Each time the home page loads recommendations or someone searches on Explore."
            legend={<LineLegend series={SEARCH_SERIES} />}
            table={<DataTable columns={[{ key: 'day', label: 'Day' }, ...SEARCH_SERIES.map((s) => ({ key: s.key, label: s.label, numeric: true }))]}
              rows={[...d.searches.per_day].reverse().map((r) => ({ ...r, day: shortDay(r.day) }))} />}
          >
            <LineChart data={d.searches.per_day} series={SEARCH_SERIES} />
          </ChartCard>

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <ChartCard
              title="Where the opened result ranked"
              description={`Position of the place people opened from their recommendations. More at 1 means better ranking. Opened from ${pct(d.mrr.selection_rate)} of lists shown.`}
              table={<DataTable columns={[{ key: 'label', label: 'Position' }, { key: 'value', label: 'Lists', numeric: true }]} rows={d.mrr.rank_distribution.map((r) => ({ label: r.rank, value: r.count }))} />}
            >
              <BarList items={d.mrr.rank_distribution.map((r) => ({ label: r.rank === '6+' ? '6th or lower' : `${r.rank}${['st', 'nd', 'rd'][Number(r.rank) - 1] || 'th'}`, value: r.count }))}
                empty="Nobody has opened a recommendation in this period." />
            </ChartCard>
            <ChartCard
              title="Categories searched"
              description="How often each category filter was used on Explore."
              table={<DataTable columns={[{ key: 'category_name', label: 'Category' }, { key: 'searches', label: 'Searches', numeric: true }]} rows={d.top_categories} />}
            >
              <BarList items={d.top_categories.map((c) => ({ label: c.category_name, value: c.searches }))} empty="No category filters were used in this period." />
            </ChartCard>
          </div>

          <section className="rounded-lg border border-granite-200 bg-surface p-5" aria-labelledby="reports-h">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="reports-h" className="text-lg">Community reports</h2>
              <Link to="/admin/reports" className="text-sm font-semibold text-green-700 hover:underline">Open the review queue →</Link>
            </div>
            <p className="mt-0.5 text-sm text-granite-700">Reports submitted in the {rangeLabel === 'all time' ? 'whole period' : rangeLabel}.</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {[
                ['Submitted', num(d.reports.submitted)],
                ['Approved', num(d.reports.approved)],
                ['Not approved', num(d.reports.rejected)],
                ['Waiting', num(d.reports.open), d.reports.needs_info ? `${d.reports.needs_info} need more info` : null],
                ['Approval rate', pct(d.reports.approval_rate), 'of decided reports'],
                ['Time to decision', d.reports.avg_hours_to_decision == null ? '–' : d.reports.avg_hours_to_decision < 1 ? 'Under 1 h' : `${d.reports.avg_hours_to_decision} h`, 'average'],
                ['Duplicates caught', num(d.reports.duplicates_caught), `warned within 150 m · ${num(d.reports.near_duplicates)} sent anyway as a different place`],
                ['Community responses', num(d.reports.community_responses), `${num(d.reports.confirms)} ${d.reports.confirms === 1 ? 'confirm' : 'confirms'} · ${num(d.reports.flags)} ${d.reports.flags === 1 ? 'flag' : 'flags'}${d.reports.hidden_by_flags ? ` · ${d.reports.hidden_by_flags} hidden` : ''}`],
              ].map(([label, value, sub]) => (
                <div key={label}>
                  <dt className="text-sm text-granite-700">{label}</dt>
                  <dd className="text-2xl font-bold">{value}</dd>
                  {sub && <dd className="text-xs text-granite-500">{sub}</dd>}
                </div>
              ))}
            </dl>
          </section>

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <section className="rounded-lg border border-granite-200 bg-surface p-5">
              <h2 className="text-lg">Top-rated places</h2>
              <p className="mt-0.5 text-sm text-granite-700">All time. Places with more reviews count for more, so one 5-star review doesn’t top the list.</p>
              <div className="mt-2">
                <Ranked rows={d.top_rated} valueHeader="Average rating"
                  value={(r) => <><Stars value={r.avg_rating} /><span className="block text-xs text-granite-500">{r.review_count} {r.review_count === 1 ? 'review' : 'reviews'}</span></>}
                  empty="No reviews yet." />
              </div>
            </section>
            <section className="rounded-lg border border-granite-200 bg-surface p-5">
              <h2 className="text-lg">Most opened</h2>
              <p className="mt-0.5 text-sm text-granite-700">Places opened most often from search results and recommendations.</p>
              <div className="mt-2">
                <Ranked rows={d.most_opened} valueHeader="Times opened"
                  value={(r) => <span className="text-sm"><span className="font-semibold tabular-nums">{r.opens}</span> <span className="text-granite-500">{r.opens === 1 ? 'time' : 'times'}</span></span>}
                  empty="Nothing has been opened from a search in this period." />
              </div>
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
