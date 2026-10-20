import PlaceSearch from '../components/PlaceSearch.jsx';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge.jsx';
import TextArea from '../components/TextArea.jsx';
import CategoryArt from '../components/CategoryArt.jsx';
import { fetchMyReports, updateMyReport } from '../api/reports.js';
import { errorMessage, fieldErrors } from '../api/client.js';
import { formatDate } from '../lib/format.js';

function UpdateForm({ report, onSaved }) {
  const [description, setDescription] = useState(report.description);
  const [access, setAccess] = useState(report.access_notes || '');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSaved(await updateMyReport(report.report_id, { description, access_notes: access }));
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-granite-100 pt-4" noValidate>
      <TextArea id={`d-${report.report_id}`} label="Description" value={description} onChange={(e) => setDescription(e.target.value)}
        error={errors.description} minLength={20} maxLength={2000} rows={4} />
      <TextArea id={`a-${report.report_id}`} label="How to get there" value={access} onChange={(e) => setAccess(e.target.value)} maxLength={500} rows={2} />
      {error && !Object.keys(errors).length && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send the update'}</button>
    </form>
  );
}

function ReportCard({ report: r, onChange }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="overflow-hidden rounded-lg border border-granite-200 bg-surface">
      <div className="flex gap-4 p-4">
        {r.photo_urls[0] ? (
          <img src={r.photo_urls[0]} alt="" className="h-20 w-20 shrink-0 rounded-md object-cover sm:h-24 sm:w-24" />
        ) : (
          <CategoryArt category={r.category_name} community className="h-20 w-20 shrink-0 rounded-md" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-lg leading-snug">{r.site_name}</h2>
            <StatusBadge status={r.status} />
          </div>
          <p className="mt-0.5 text-sm text-granite-700">{r.category_name} · sent {formatDate(r.submitted_at)}</p>
          {['pending', 'under_review'].includes(r.status) && (
            <p className="mt-2 text-sm text-granite-700">
              {r.confirm_count === 1 ? '1 person has' : `${r.confirm_count} people have`} confirmed it.
              {r.status === 'pending' ? ' At 3 confirmations it moves up the review queue.' : ' An administrator will review it soon.'}
            </p>
          )}
          {r.is_hidden && r.status !== 'approved' && r.status !== 'rejected' && (
            <p className="mt-2 text-sm text-granite-700">Hidden from the public list after several flags. An administrator will still review it.</p>
          )}
          {r.status === 'approved' && r.attraction_id && (
            <Link to={`/attractions/${r.attraction_id}`} className="mt-2 inline-block text-sm font-semibold text-green-700 hover:underline">
              It’s on the map now: view it →
            </Link>
          )}
        </div>
      </div>
      {r.review_note && ['rejected', 'needs_info'].includes(r.status) && (
        <div className={`border-t px-4 py-3 text-sm ${r.status === 'rejected' ? 'border-granite-100 text-granite-900' : 'border-laterite-50 bg-laterite-50/60 text-granite-900'}`}>
          <p>
            <span className="font-semibold">{r.status === 'rejected' ? 'Reason: ' : 'The administrator asks: '}</span>
            {r.review_note}
          </p>
          {r.status === 'needs_info' && !editing && (
            <button type="button" className="btn-quiet mt-3 !py-2" onClick={() => setEditing(true)}>Update the report</button>
          )}
          {r.status === 'needs_info' && editing && (
            <UpdateForm report={r} onSaved={(updated) => { setEditing(false); onChange(updated); }} />
          )}
        </div>
      )}
    </li>
  );
}

export default function MyReportsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // Show the thank-you once, then drop it from history so it doesn't come back on a later visit.
  const [submitted] = useState(location.state?.submitted);
  useEffect(() => {
    if (location.state?.submitted) navigate(location.pathname, { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [state, setState] = useState({ loading: true, error: '', reports: [] });

  useEffect(() => {
    fetchMyReports()
      .then((reports) => setState({ loading: false, error: '', reports }))
      .catch((err) => setState({ loading: false, error: errorMessage(err), reports: [] }));
  }, []);

  const [query, setQuery] = useState('');
  const searchTerm = query.trim().toLocaleLowerCase();
  const visibleReports = state.reports.filter((r) => [r.site_name, r.local_name].filter(Boolean).join(' ').toLocaleLowerCase().includes(searchTerm));

  const replace = (updated) => setState((s) => ({ ...s, reports: s.reports.map((r) => (r.report_id === updated.report_id ? { ...r, ...updated } : r)) }));

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl">Your reports</h1>
        <Link to="/report" className="btn-primary">Add a place</Link>
      </div>
      {submitted && (
        <p role="status" className="mt-5 rounded-md bg-green-50 px-4 py-3 text-green-700">
          Thank you. “{submitted}” has been sent. People nearby can now confirm it, and an administrator will review it.
        </p>
      )}
      <PlaceSearch value={query} onChange={setQuery} />
      {state.error && <p role="alert" className="mt-5 text-danger">{state.error}</p>}
      {state.loading && <p className="mt-6 text-granite-500">Loading…</p>}
      {!state.loading && !state.error && state.reports.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-granite-200 p-6">
          <p className="font-semibold">You haven’t reported any places yet.</p>
          <p className="mt-1 text-granite-700">Know somewhere worth visiting that isn’t on the map? Add it so others can find it.</p>
        </div>
      )}
      {!state.loading && !state.error && state.reports.length > 0 && visibleReports.length === 0 && (
        <p role="status" className="my-4 text-granite-700">No places match “{query.trim()}”. Try another name or clear the search.</p>
      )}
      <ul className="mt-6 space-y-3">
        {visibleReports.map((r) => <ReportCard key={r.report_id} report={r} onChange={replace} />)}
      </ul>
    </section>
  );
}
