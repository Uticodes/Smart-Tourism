import PlaceSearch from '../components/PlaceSearch.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MapView, { ABUJA_CENTRE } from '../components/map/MapView.jsx';
import useGeolocation from '../hooks/useGeolocation.js';
import { fetchNearbyReports, respondToReport } from '../api/reports.js';
import { errorMessage } from '../api/client.js';
import { inFCT, km } from '../lib/format.js';

const RADII = [5, 10, 25, 50];
const FLAG_REASONS = [
  'The place doesn’t exist, or the pin is in the wrong place',
  'It’s private property or not open to the public',
  'It’s unsafe to visit',
  'It’s already on the map under another name',
  'Something else',
];

function Photos({ urls, name }) {
  if (!urls.length) return null;
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto">
      {urls.map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className="shrink-0">
          <img src={u} alt={`${name}, photo ${i + 1}`} className="h-24 w-32 rounded-md object-cover" loading="lazy" />
        </a>
      ))}
    </div>
  );
}

function FlagForm({ onSubmit, onCancel, busy }) {
  const [choice, setChoice] = useState('');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState('');
  function submit(e) {
    e.preventDefault();
    if (!choice) return setError('Choose a reason.');
    if (choice === 'Something else' && detail.trim().length < 3) return setError('Say what is wrong.');
    const reason = choice === 'Something else' ? detail.trim() : detail.trim() ? `${choice}: ${detail.trim()}` : choice;
    onSubmit(reason.slice(0, 255));
  }
  return (
    <form onSubmit={submit} className="mt-3 rounded-md border border-granite-200 p-4" noValidate>
      <fieldset>
        <legend className="font-semibold">What’s wrong with this report?</legend>
        <div className="mt-2 space-y-1.5">
          {FLAG_REASONS.map((r) => (
            <label key={r} className="flex cursor-pointer items-start gap-2 text-[15px]">
              <input type="radio" name="flag-reason" value={r} checked={choice === r} onChange={() => { setChoice(r); setError(''); }} className="mt-1 accent-green-600" />
              {r}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor="flag-detail" className="label mt-3">Details {choice === 'Something else' ? '' : '(optional)'}</label>
      <input id="flag-detail" className="field" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={180} />
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" className="btn-primary !bg-laterite-600 hover:!bg-[#7d321b]" disabled={busy}>{busy ? 'Sending…' : 'Send flag'}</button>
        <button type="button" className="btn-quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function ReportItem({ report: r, selected, onSelect, onResponded, itemRef }) {
  const [flagging, setFlagging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(response, reason) {
    setBusy(true);
    setError('');
    try {
      const result = await respondToReport(r.report_id, { response, reason });
      setFlagging(false);
      onResponded(r.report_id, result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const needed = Math.max(0, 3 - r.confirm_count);
  return (
    <li ref={itemRef} className={`rounded-lg border bg-surface p-4 sm:p-5 ${selected ? 'border-granite-500 ring-1 ring-granite-500' : 'border-granite-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => onSelect(r.report_id)} className="text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-granite-500 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-granite-700">
            Unverified
          </span>
          <span className="mt-2 block text-lg font-semibold leading-snug">{r.site_name}</span>
          {r.local_name && <span className="block text-sm text-granite-700">Known locally as {r.local_name}</span>}
        </button>
        <span className="shrink-0 text-sm font-semibold text-granite-700">{km(r.distance_km)}</span>
      </div>
      <p className="mt-1 text-sm text-granite-700">{r.category_name}</p>
      <p className="mt-2 text-[15px] leading-relaxed">{r.description}</p>
      {r.access_notes && <p className="mt-1 text-sm text-granite-700"><span className="font-semibold">Getting there: </span>{r.access_notes}</p>}
      <Photos urls={r.photo_urls} name={r.site_name} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-granite-100 pt-3">
        <p className="text-sm text-granite-700">
          {r.confirm_count} confirmed
          {r.status === 'pending' ? ` · ${needed} more for review` : ' · with the administrator'}
        </p>
        {r.my_response ? (
          <p className={`text-sm font-semibold ${r.my_response === 'confirm' ? 'text-green-700' : 'text-laterite-600'}`}>
            {r.my_response === 'confirm' ? '✓ You confirmed this place' : 'You flagged this report'}
          </p>
        ) : (
          !flagging && (
            <div className="flex gap-2">
              <button type="button" className="btn-primary !py-2" onClick={() => send('confirm')} disabled={busy}>I know it: confirm</button>
              <button type="button" className="btn-quiet !py-2" onClick={() => setFlagging(true)} disabled={busy}>Flag</button>
            </div>
          )
        )}
      </div>
      {flagging && <FlagForm busy={busy} onCancel={() => setFlagging(false)} onSubmit={(reason) => send('flag', reason)} />}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </li>
  );
}

export default function CommunityPage() {
  const geo = useGeolocation();
  const [origin, setOrigin] = useState(ABUJA_CENTRE);
  const [notice, setNotice] = useState('');
  const [radius, setRadius] = useState(25);
  const [state, setState] = useState({ loading: true, error: '', reports: [] });
  const [query, setQuery] = useState('');
  const searchTerm = query.trim().toLocaleLowerCase();
  const visibleReports = state.reports.filter((r) => [r.site_name, r.local_name].filter(Boolean).join(' ').toLocaleLowerCase().includes(searchTerm));

  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState('list');
  const refs = useRef({});

  useEffect(() => {
    if (geo.status !== 'ready' || !geo.position) return;
    if (inFCT(geo.position)) {
      setOrigin({ ...geo.position, label: 'Your location' });
      setNotice('');
    } else {
      setOrigin(ABUJA_CENTRE);
      setNotice('You appear to be outside the FCT, so reports around Abuja city centre are shown.');
    }
  }, [geo.status, geo.position]);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    fetchNearbyReports({ lat: origin.lat, lng: origin.lng, radius })
      .then((reports) => !cancelled && setState({ loading: false, error: '', reports }))
      .catch((err) => !cancelled && setState({ loading: false, error: errorMessage(err), reports: [] }));
    return () => { cancelled = true; };
  }, [origin.lat, origin.lng, radius]);

  const markers = useMemo(
    () => visibleReports.map((r) => ({ id: r.report_id, lat: Number(r.latitude), lng: Number(r.longitude), name: `Unverified: ${r.site_name}`, source: 'pending' })),
    [visibleReports]
  );

  function onResponded(id, result) {
    setState((s) => ({
      ...s,
      reports: s.reports
        .map((r) => (r.report_id === id ? { ...r, ...result } : r))
        .filter((r) => !r.is_hidden),
    }));
  }

  function select(id) {
    setSelectedId(id);
    setView('list');
    refs.current[id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-3xl">Help check new places</h1>
          <p className="mt-2 text-granite-700">
            People nearby reported these places, and nobody has checked them yet. If you know one, confirm it’s real.
            If something is wrong, private or unsafe, flag it.
          </p>
        </div>
        <Link to="/report" className="btn-quiet">Add a place</Link>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-quiet !py-2" onClick={geo.locate} disabled={geo.status === 'locating'}>
          {geo.status === 'locating' ? 'Finding you…' : 'Use my location'}
        </button>
        <label htmlFor="c-radius" className="sr-only">Distance</label>
        <select id="c-radius" className="field !w-auto !py-2" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
          {RADII.map((r) => <option key={r} value={r}>Within {r} km</option>)}
        </select>
        <span className="text-sm text-granite-500">
          {origin.label === 'Your location' ? 'of you' : 'of Abuja city centre'}
        </span>
      </div>
      {(notice || geo.error) && <p role="status" className="mt-3 rounded-md bg-laterite-50 px-4 py-2.5 text-sm text-laterite-600">{notice || geo.error}</p>}

      <PlaceSearch value={query} onChange={setQuery} />
      <div className="mt-4 flex gap-2 lg:hidden" role="tablist" aria-label="View">
        {['list', 'map'].map((v) => (
          <button key={v} role="tab" aria-selected={view === v} type="button" onClick={() => setView(v)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${view === v ? 'bg-granite-900 text-white' : 'bg-granite-100 text-granite-700'}`}>
            {v === 'list' ? `List (${visibleReports.length})` : 'Map'}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <div className={view === 'map' ? 'hidden lg:block' : ''}>
          {state.error && <p role="alert" className="text-danger">{state.error}</p>}
          {state.loading && <p className="text-granite-500">Loading…</p>}
          {!state.loading && !state.error && state.reports.length === 0 && (
            <div className="rounded-lg border border-dashed border-granite-200 p-6">
              <p className="font-semibold">Nothing to check within {radius} km.</p>
              <p className="mt-1 text-granite-700">Try a larger distance. Your own reports are not shown here, because people cannot confirm their own reports.</p>
            </div>
          )}
          {!state.loading && !state.error && state.reports.length > 0 && visibleReports.length === 0 && (
            <p role="status" className="my-4 text-granite-700">No places match “{query.trim()}”. Try another name or clear the search.</p>
          )}
          <ul className="space-y-3">
            {visibleReports.map((r) => (
              <ReportItem key={r.report_id} report={r} selected={r.report_id === selectedId} onSelect={setSelectedId}
                onResponded={onResponded} itemRef={(el) => { refs.current[r.report_id] = el; }} />
            ))}
          </ul>
        </div>
        <div className={`${view === 'list' ? 'hidden lg:block' : ''} lg:sticky lg:top-20 lg:self-start`}>
          <MapView center={origin} markers={markers} selectedId={selectedId} onSelect={select} userPosition={origin}
            fitToMarkers={markers.length > 0} zoom={11} className="h-[480px] lg:h-[560px]" />
          <p className="mt-2 text-sm text-granite-500">Grey pins are unverified reports. They are not on the main map until an administrator approves them.</p>
        </div>
      </div>
    </section>
  );
}
