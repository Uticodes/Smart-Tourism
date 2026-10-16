import { useEffect, useMemo, useRef, useState } from 'react';
import MapView, { ABUJA_CENTRE } from '../components/map/MapView.jsx';
import Stars from '../components/Stars.jsx';
import useGeolocation from '../hooks/useGeolocation.js';
import { searchNearby } from '../api/attractions.js';
import { fetchCategories } from '../api/users.js';
import { errorMessage } from '../api/client.js';

// Same approximate box as the server's FCT check.
const inFCT = (p) => p.lat >= 8.3 && p.lat <= 9.4 && p.lng >= 6.7 && p.lng <= 7.7;
const km = (d) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`);

export default function ExplorePage() {
  const geo = useGeolocation();
  const [origin, setOrigin] = useState(ABUJA_CENTRE);
  const [notice, setNotice] = useState('');
  const [picking, setPicking] = useState(false);
  const [radius, setRadius] = useState(10);
  const [debouncedRadius, setDebouncedRadius] = useState(10);
  const [category, setCategory] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState({ loading: true, error: '', items: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState('list'); // mobile only
  const itemRefs = useRef({});

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  // Wait until the slider stops moving before searching.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedRadius(radius), 300);
    return () => clearTimeout(t);
  }, [radius]);

  // Use the device position once it arrives, unless it is outside the FCT.
  useEffect(() => {
    if (geo.status !== 'ready' || !geo.position) return;
    if (inFCT(geo.position)) {
      setOrigin({ ...geo.position, label: 'Your location' });
      setNotice('');
    } else {
      setOrigin(ABUJA_CENTRE);
      setNotice('You appear to be outside the FCT, so results are shown around Abuja city centre.');
    }
  }, [geo.status, geo.position]);

  useEffect(() => {
    let cancelled = false;
    setResults((r) => ({ ...r, loading: true, error: '' }));
    searchNearby({ lat: origin.lat, lng: origin.lng, radius: debouncedRadius, category: category || undefined, minRating: minRating || undefined })
      .then((data) => !cancelled && setResults({ loading: false, error: '', items: data.attractions }))
      .catch((err) => !cancelled && setResults({ loading: false, error: errorMessage(err), items: [] }));
    return () => {
      cancelled = true;
    };
  }, [origin.lat, origin.lng, debouncedRadius, category, minRating]);

  const markers = useMemo(
    () => results.items.map((a) => ({ id: a.attraction_id, lat: Number(a.latitude), lng: Number(a.longitude), name: a.name, source: a.source })),
    [results.items]
  );

  // Frame the whole search circle (south-west and north-east corners of its bounding box).
  const circleBounds = useMemo(() => {
    const dLat = debouncedRadius / 111.32;
    const dLng = debouncedRadius / (111.32 * Math.cos((origin.lat * Math.PI) / 180));
    return [[origin.lat - dLat, origin.lng - dLng], [origin.lat + dLat, origin.lng + dLng]];
  }, [origin.lat, origin.lng, debouncedRadius]);

  function select(id) {
    setSelectedId(id);
    itemRefs.current[id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function onMapClick(p) {
    if (!picking) return;
    if (!inFCT(p)) {
      setNotice('That point is outside the FCT. Choose a point inside the territory.');
      return;
    }
    setOrigin({ ...p, label: 'Chosen point' });
    setPicking(false);
    setNotice('');
  }

  const label = 'mb-1 block text-sm font-semibold text-granite-700';

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl">
        {origin.label === 'Your location' ? 'Explore near you' : origin.label === 'Chosen point' ? 'Explore around your chosen point' : 'Explore around Abuja city centre'}
      </h1>

      <div className="mt-5 grid gap-4 rounded-lg border border-granite-200 bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_0.8fr]">
        <div>
          <span className={label}>Search from</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-quiet !py-2" onClick={geo.locate} disabled={geo.status === 'locating'}>
              {geo.status === 'locating' ? 'Finding you…' : 'Use my location'}
            </button>
            <button
              type="button"
              className={`btn-quiet !py-2 ${picking ? '!border-green-600 !bg-green-50 !text-green-700' : ''}`}
              aria-pressed={picking}
              onClick={() => { setPicking((v) => !v); setView('map'); }}
            >
              {picking ? 'Click the map…' : 'Choose on map'}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="radius" className={label}>Within {radius} km</label>
          <input id="radius" type="range" min="1" max="50" step="1" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="mt-2 w-full accent-green-600" />
        </div>
        <div>
          <label htmlFor="category" className={label}>Category</label>
          <select id="category" className="field !py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="rating" className={label}>Rating</label>
          <select id="rating" className="field !py-2" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
            <option value={0}>Any</option>
            <option value={3}>3★ and up</option>
            <option value={4}>4★ and up</option>
          </select>
        </div>
      </div>

      {(notice || geo.error) && (
        <p role="status" className="mt-3 rounded-md bg-laterite-50 px-4 py-2.5 text-sm text-laterite-600">{notice || geo.error}</p>
      )}

      <div className="mt-4 flex gap-2 lg:hidden" role="tablist" aria-label="Results view">
        {['list', 'map'].map((v) => (
          <button key={v} role="tab" aria-selected={view === v} type="button" onClick={() => setView(v)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${view === v ? 'bg-granite-900 text-white' : 'bg-granite-100 text-granite-700'}`}>
            {v === 'list' ? `List (${results.items.length})` : 'Map'}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className={`${view === 'map' ? 'hidden lg:block' : ''}`}>
          <p className="mb-3 text-sm text-granite-500" aria-live="polite">
            {results.loading ? 'Searching…' : `${results.items.length} ${results.items.length === 1 ? 'place' : 'places'} within ${debouncedRadius} km, nearest first`}
          </p>
          {results.error && <p role="alert" className="text-danger">{results.error}</p>}
          {!results.loading && !results.error && results.items.length === 0 && (
            <div className="rounded-lg border border-dashed border-granite-200 p-6">
              <p className="font-semibold">Nothing within {debouncedRadius} km.</p>
              <p className="mt-1 text-granite-700">Increase the distance, clear the filters, or move the search point.</p>
            </div>
          )}
          <ul className="space-y-2 lg:max-h-[560px] lg:overflow-y-auto lg:pr-1">
            {results.items.map((a) => {
              const on = a.attraction_id === selectedId;
              return (
                <li key={a.attraction_id} ref={(el) => { itemRefs.current[a.attraction_id] = el; }}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(a.attraction_id)}
                    className={`w-full rounded-lg border bg-surface p-4 text-left transition-colors ${on ? 'border-green-600 ring-1 ring-green-600' : 'border-granite-200 hover:border-granite-500'}`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-semibold">{a.name}</span>
                      <span className="shrink-0 text-sm font-semibold text-granite-700">{km(a.distance_km)}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-granite-700">
                      <span>{a.category_name}</span>
                      <Stars value={a.avg_rating} count={a.review_count || null} />
                      {a.source === 'community' && <span className="community-badge">Community-discovered</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className={`${view === 'list' ? 'hidden lg:block' : ''} lg:sticky lg:top-4 lg:self-start`}>
          <MapView
            center={origin}
            markers={markers}
            selectedId={selectedId}
            onSelect={select}
            userPosition={origin}
            radiusKm={debouncedRadius}
            bounds={picking ? null : circleBounds}
            onMapClick={onMapClick}
            className={`h-[480px] lg:h-[600px] ${picking ? 'cursor-crosshair ring-2 ring-green-600' : ''}`}
          />
        </div>
      </div>
    </section>
  );
}
