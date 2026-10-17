import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AdminNav from '../../components/AdminNav.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { adminListReports } from '../../api/reports.js';
import { errorMessage } from '../../api/client.js';

const TABS = [
  ['open', 'To review'],
  ['approved', 'Approved'],
  ['rejected', 'Not approved'],
  ['all', 'All'],
];

const ago = (iso) => {
  const hours = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.floor(hours)} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

export default function AdminReportsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [done] = useState(location.state?.done);
  useEffect(() => {
    if (location.state?.done) navigate(location.pathname, { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [status, setStatus] = useState('open');
  const [state, setState] = useState({ loading: true, error: '', reports: [], counts: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    adminListReports({ status })
      .then((d) => !cancelled && setState({ loading: false, error: '', ...d }))
      .catch((err) => !cancelled && setState((s) => ({ ...s, loading: false, error: errorMessage(err) })));
    return () => { cancelled = true; };
  }, [status]);

  const c = state.counts;
  const tabCount = (key) => {
    if (!c) return null;
    if (key === 'open') return c.pending + c.under_review + c.needs_info;
    if (key === 'all') return c.pending + c.under_review + c.needs_info + c.approved + c.rejected;
    return c[key];
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <AdminNav />
      <h1 className="text-3xl">Review queue</h1>
      <p className="mt-1 text-granite-700">Places reported by visitors and residents. Most-confirmed first, then oldest first.</p>

      {done && <p role="status" className="mt-4 rounded-md bg-green-50 px-4 py-3 text-green-700">{done}</p>}

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Report status">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={status === key} onClick={() => setStatus(key)}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${status === key ? 'bg-granite-900 text-white' : 'bg-surface text-granite-700 ring-1 ring-granite-200 hover:bg-granite-100'}`}>
            {label}{tabCount(key) != null && <span className="ml-1.5 opacity-75">{tabCount(key)}</span>}
          </button>
        ))}
      </div>

      {state.error && <p role="alert" className="mt-4 text-danger">{state.error}</p>}

      <div className="mt-5 overflow-x-auto rounded-lg border border-granite-200 bg-surface">
        <table className="w-full min-w-[820px] text-left text-[15px]">
          <thead className="border-b border-granite-200 bg-granite-100/60 text-sm text-granite-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Place</th>
              <th className="px-4 py-3 font-semibold">Reported by</th>
              <th className="px-4 py-3 font-semibold">Community</th>
              <th className="px-4 py-3 font-semibold">Nearest existing place</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {state.loading && <tr><td colSpan={5} className="px-4 py-6 text-granite-500">Loading…</td></tr>}
            {!state.loading && state.reports.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-granite-500">{status === 'open' ? 'Nothing waiting for review.' : 'No reports here.'}</td></tr>
            )}
            {!state.loading && state.reports.map((r) => (
              <tr key={r.report_id} className="border-b border-granite-100 align-top last:border-0 hover:bg-granite-100/40">
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    {r.photo_urls[0] && <img src={r.photo_urls[0]} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />}
                    <div>
                      <Link to={`/admin/reports/${r.report_id}`} className="font-semibold text-granite-900 hover:text-green-700 hover:underline">{r.site_name}</Link>
                      <p className="text-sm text-granite-700">{r.category_name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  {r.reporter_name}
                  <span className="block text-granite-500">{ago(r.submitted_at)}</span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="font-semibold text-green-700">{r.confirm_count} ✓</span>
                  <span className={`ml-3 font-semibold ${r.flag_count ? 'text-laterite-600' : 'text-granite-500'}`}>{r.flag_count} flags</span>
                  {r.is_hidden && <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-laterite-600">Hidden by flags</span>}
                </td>
                <td className="px-4 py-3 text-sm">
                  {r.nearest ? (
                    <>
                      {r.nearest.name}
                      <span className={`block ${r.nearest.distance_m <= 150 ? 'font-semibold text-laterite-600' : 'text-granite-500'}`}>
                        {Math.round(r.nearest.distance_m)} m away{r.nearest.distance_m <= 150 ? ' · reporter said it is different' : ''}
                      </span>
                    </>
                  ) : <span className="text-granite-500">Nothing within 1 km</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
