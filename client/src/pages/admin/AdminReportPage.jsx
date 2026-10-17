import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Polyline } from 'react-leaflet';
import AdminNav from '../../components/AdminNav.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import FormField from '../../components/FormField.jsx';
import TextArea from '../../components/TextArea.jsx';
import MapView from '../../components/map/MapView.jsx';
import { adminDecideReport, adminGetReport } from '../../api/reports.js';
import { fetchCategories } from '../../api/users.js';
import { errorMessage, fieldErrors } from '../../api/client.js';
import { formatDate } from '../../lib/format.js';

const ACTIONS = {
  approve: { label: 'Approve and publish', done: (n) => `“${n}” is now on the map with the Community-discovered badge.` },
  needs_info: { label: 'Ask for more information', done: (n) => `The reporter of “${n}” has been asked for more information.` },
  reject: { label: 'Reject', done: (n) => `“${n}” was not approved. The reporter can see your reason.` },
};

function Gallery({ urls, name }) {
  const [i, setI] = useState(0);
  if (!urls.length) return <p className="rounded-lg border border-dashed border-granite-200 p-6 text-granite-500">No photos.</p>;
  return (
    <div>
      <a href={urls[i]} target="_blank" rel="noreferrer">
        <img src={urls[i]} alt={`${name}, photo ${i + 1} of ${urls.length}`} className="aspect-[4/3] w-full rounded-lg bg-granite-100 object-cover" />
      </a>
      {urls.length > 1 && (
        <div className="mt-2 flex gap-2">
          {urls.map((u, j) => (
            <button key={u} type="button" onClick={() => setI(j)} aria-label={`Show photo ${j + 1}`} aria-current={i === j}
              className={`h-16 w-20 overflow-hidden rounded-md border-2 ${i === j ? 'border-green-600' : 'border-transparent opacity-70 hover:opacity-100'}`}>
              <img src={u} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [categories, setCategories] = useState([]);
  const [edits, setEdits] = useState({ site_name: '', category_id: '', description: '' });
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [busy, setBusy] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
    adminGetReport(id)
      .then((r) => {
        setReport(r);
        setEdits({ site_name: r.site_name, category_id: String(r.category_id), description: r.description });
      })
      .catch((err) => setLoadError(errorMessage(err)));
  }, [id]);

  const point = report ? { lat: Number(report.latitude), lng: Number(report.longitude) } : null;
  const markers = useMemo(() => {
    if (!report) return [];
    const m = [{ id: 'report', lat: point.lat, lng: point.lng, name: `Reported: ${report.site_name}`, source: 'community' }];
    if (report.nearest) m.push({ id: 'nearest', lat: report.nearest.latitude, lng: report.nearest.longitude, name: `${report.nearest.kind === 'attraction' ? 'On the map' : 'Other report'}: ${report.nearest.name}`, source: report.nearest.kind === 'attraction' ? 'curated' : 'pending' });
    return m;
  }, [report]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <AdminNav />
        <p role="alert" className="text-danger">{loadError}</p>
        <Link to="/admin/reports" className="btn-quiet mt-4">Back to the queue</Link>
      </section>
    );
  }
  if (!report) return <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><AdminNav /><p className="text-granite-500">Loading…</p></section>;

  const open = ['pending', 'under_review', 'needs_info'].includes(report.status);

  async function decide(action) {
    setErrors({});
    setBanner('');
    if (action !== 'approve' && note.trim().length < 3) {
      setErrors({ note: action === 'reject' ? 'Give the reporter a reason.' : 'Say what information you need.' });
      document.getElementById('note')?.focus();
      return;
    }
    const changed = {};
    if (edits.site_name.trim() !== report.site_name) changed.site_name = edits.site_name.trim();
    if (Number(edits.category_id) !== report.category_id) changed.category_id = Number(edits.category_id);
    if (edits.description.trim() !== report.description) changed.description = edits.description.trim();
    setBusy(action);
    try {
      const updated = await adminDecideReport(report.report_id, { action, note: note.trim() || undefined, edits: changed });
      navigate('/admin/reports', { state: { done: ACTIONS[action].done(updated.site_name) } });
    } catch (err) {
      const f = fieldErrors(err);
      const mapped = {};
      for (const d of err.response?.data?.details || []) {
        const key = d.path?.[d.path.length - 1];
        if (key) mapped[key] = d.message;
      }
      setErrors({ ...f, ...mapped });
      setBanner(errorMessage(err));
    } finally {
      setBusy('');
    }
  }

  const responses = report.responses || [];
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <AdminNav />
      <Link to="/admin/reports" className="text-sm font-semibold text-granite-700 hover:text-green-700">← Review queue</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl">{report.site_name}</h1>
        <StatusBadge status={report.status} />
        {report.is_hidden && <span className="rounded-full bg-laterite-50 px-2.5 py-1 text-xs font-semibold text-laterite-600">Hidden by community flags</span>}
      </div>
      <p className="mt-1 text-granite-700">
        {report.category_name} · reported by {report.reporter_name} ({report.reporter_email}) on {formatDate(report.submitted_at)}
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <div className="min-w-0 space-y-6">
          <Gallery urls={report.photo_urls} name={report.site_name} />

          <section className="rounded-lg border border-granite-200 bg-surface p-5">
            <h2 className="text-lg">What the reporter said</h2>
            <dl className="mt-3 space-y-3 text-[15px]">
              {report.local_name && <div><dt className="text-sm font-semibold text-granite-700">Local name</dt><dd>{report.local_name}</dd></div>}
              <div><dt className="text-sm font-semibold text-granite-700">Description</dt><dd className="whitespace-pre-line">{report.description}</dd></div>
              {report.access_notes && <div><dt className="text-sm font-semibold text-granite-700">Getting there</dt><dd>{report.access_notes}</dd></div>}
              <div><dt className="text-sm font-semibold text-granite-700">Public access</dt><dd>{report.public_access ? 'Declared open to the public' : 'Not declared'}</dd></div>
              <div><dt className="text-sm font-semibold text-granite-700">Coordinates</dt><dd className="tabular-nums">{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</dd></div>
            </dl>
          </section>

          <section className="rounded-lg border border-granite-200 bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg">Community responses</h2>
              <p className="text-sm">
                <span className="font-semibold text-green-700">{report.confirm_count} confirmed</span>
                <span className="ml-3 font-semibold text-laterite-600">{report.flag_count} flagged</span>
              </p>
            </div>
            {responses.length === 0 ? (
              <p className="mt-2 text-granite-500">Nobody has responded yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-granite-100">
                {responses.map((v, i) => (
                  <li key={i} className="py-2.5 text-[15px]">
                    <span className={`font-semibold ${v.response === 'confirm' ? 'text-green-700' : 'text-laterite-600'}`}>
                      {v.response === 'confirm' ? 'Confirmed' : 'Flagged'}
                    </span>{' '}
                    by {v.user_name} · <span className="text-granite-500">{formatDate(v.created_at)}</span>
                    {v.reason && <p className="mt-0.5 text-granite-700">“{v.reason}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
          <div>
            <MapView center={point} zoom={16} markers={markers} fitToMarkers={Boolean(report.nearest)} fitMaxZoom={18} className="h-[300px]">
              {report.nearest && (
                <Polyline positions={[[point.lat, point.lng], [report.nearest.latitude, report.nearest.longitude]]} pathOptions={{ color: '#2B3036', weight: 2, dashArray: '5 6' }} />
              )}
            </MapView>
            <p className="mt-2 text-sm text-granite-700">
              {report.nearest
                ? <>Red pin: this report. {report.nearest.kind === 'attraction' ? 'Green pin' : 'Grey pin'}: <span className="font-semibold">{report.nearest.name}</span>, {Math.round(report.nearest.distance_m)} m away{report.nearest.kind === 'attraction' && <> (<Link to={`/attractions/${report.nearest.id}`} target="_blank" className="text-green-700 underline">open</Link>)</>}.</>
                : 'No existing place within 1 km.'}
            </p>
          </div>

          {open ? (
            <div className="rounded-lg border border-granite-200 bg-surface p-5">
              <h2 className="text-lg">Decision</h2>
              <p className="mt-1 text-sm text-granite-700">Correct the details before approving if needed. These are what visitors will see.</p>
              {banner && <p role="alert" className="mt-3 rounded-md bg-[#FBE9E7] px-3 py-2 text-sm text-danger">{banner}</p>}
              <div className="mt-4 space-y-4">
                <FormField id="site_name" label="Name" value={edits.site_name} onChange={(e) => setEdits({ ...edits, site_name: e.target.value })} error={errors.site_name} maxLength={150} />
                <div>
                  <label htmlFor="category_id" className="label">Category</label>
                  <select id="category_id" className="field" value={edits.category_id} onChange={(e) => setEdits({ ...edits, category_id: e.target.value })}>
                    {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                  </select>
                  {errors.category_id && <p className="mt-1.5 text-sm text-danger">{errors.category_id}</p>}
                </div>
                <TextArea id="description" label="Description" value={edits.description} onChange={(e) => setEdits({ ...edits, description: e.target.value })}
                  error={errors.description} minLength={20} maxLength={2000} rows={5} />
                <TextArea id="note" label="Note to the reporter" hint="Required to reject or to ask for more information" value={note}
                  onChange={(e) => setNote(e.target.value)} error={errors.note} maxLength={255} rows={2} />
              </div>
              <div className="mt-5 flex flex-col gap-2">
                <button type="button" className="btn-primary" onClick={() => decide('approve')} disabled={Boolean(busy)}>
                  {busy === 'approve' ? 'Publishing…' : ACTIONS.approve.label}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn-quiet" onClick={() => decide('needs_info')} disabled={Boolean(busy)}>
                    {busy === 'needs_info' ? 'Sending…' : 'Ask for info'}
                  </button>
                  <button type="button" className="btn-quiet !text-danger" onClick={() => decide('reject')} disabled={Boolean(busy)}>
                    {busy === 'reject' ? 'Rejecting…' : 'Reject'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-granite-200 bg-surface p-5">
              <h2 className="text-lg">Decision</h2>
              <p className="mt-2 text-[15px]">
                {report.status === 'approved' ? 'Approved' : 'Not approved'}
                {report.reviewer_name && <> by {report.reviewer_name}</>}
                {report.reviewed_at && <> on {formatDate(report.reviewed_at)}</>}.
              </p>
              {report.review_note && <p className="mt-1 text-granite-700">Note: {report.review_note}</p>}
              {report.attraction_id && (
                <Link to={`/attractions/${report.attraction_id}`} className="btn-quiet mt-3">View the published place</Link>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
