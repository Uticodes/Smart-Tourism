import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AttractionCard from '../components/AttractionCard.jsx';
import MapView, { ABUJA_CENTRE } from '../components/map/MapView.jsx';
import useGeolocation from '../hooks/useGeolocation.js';
import { fetchRecommendations, recordSelection } from '../api/recommendations.js';
import { errorMessage } from '../api/client.js';
import { inFCT, km } from '../lib/format.js';

const RADII = [5, 10, 15, 25, 50];
const SHOW = 9;

function Explanation({ data, user }) {
  if (!data) return null;
  if (data.personalised) {
    const names = data.preferences.map((p) => p.category_name);
    return (
      <p className="text-granite-700">
        Ranked by your interests ({names.join(', ')}), then rating and distance.{' '}
        <Link to="/preferences" className="font-semibold text-green-700 underline-offset-2 hover:underline">Change interests</Link>
      </p>
    );
  }
  return (
    <p className="text-granite-700">
      Ranked by rating and distance.{' '}
      {user ? (
        <Link to="/preferences" className="font-semibold text-green-700 underline-offset-2 hover:underline">Choose your interests</Link>
      ) : (
        <Link to="/login" className="font-semibold text-green-700 underline-offset-2 hover:underline">Sign in</Link>
      )}{' '}
      to put the kinds of places you like first.
    </p>
  );
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const geo = useGeolocation();
  const [origin, setOrigin] = useState(ABUJA_CENTRE);
  const [notice, setNotice] = useState('');
  const [radius, setRadius] = useState(15);
  const [view, setView] = useState('list');
  const [state, setState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    if (geo.status !== 'ready' || !geo.position) return;
    if (inFCT(geo.position)) {
      setOrigin({ ...geo.position, label: 'Your location' });
      setNotice('');
    } else {
      setOrigin(ABUJA_CENTRE);
      setNotice('You appear to be outside the FCT, so recommendations are around Abuja city centre.');
    }
  }, [geo.status, geo.position]);

  // Wait for the session check so a signed-in user gets personalised results first time.
  useEffect(() => {
    if (authLoading) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    fetchRecommendations({ lat: origin.lat, lng: origin.lng, radius })
      .then((data) => !cancelled && setState({ loading: false, error: '', data }))
      .catch((err) => !cancelled && setState({ loading: false, error: errorMessage(err), data: null }));
    return () => {
      cancelled = true;
    };
  }, [origin.lat, origin.lng, radius, authLoading, user?.user_id, user?.preference_count]);

  const items = state.data?.attractions.slice(0, SHOW) || [];
  const markers = useMemo(
    () => items.map((a) => ({ id: a.attraction_id, lat: Number(a.latitude), lng: Number(a.longitude), name: a.name, source: a.source, a })),
    [items]
  );
  const open = (a) => () => recordSelection({ search_id: state.data?.search_id, attraction_id: a.attraction_id, rank: a.rank });
  const linkState = { origin: { lat: origin.lat, lng: origin.lng, label: origin.label } };

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-12 sm:px-6 sm:pt-16">
        <h1 className="max-w-3xl text-4xl leading-[1.08] sm:text-6xl">
          Find the places Abuja knows about, even the ones the maps don’t.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-granite-700">
          Get recommendations near you, directions to each site, and add attractions that only
          locals know so others can find them too.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/explore" className="btn-primary">Explore attractions near you</Link>
          {!user && <Link to="/register" className="btn-quiet">Create an account</Link>}
        </div>
      </section>

      <section aria-labelledby="recs" className="border-t border-granite-200 bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2 id="recs" className="text-2xl sm:text-3xl">
                {state.data?.personalised ? 'Recommended for you' : 'Recommended places'}{' '}
                <span className="text-granite-500">
                  {origin.label === 'Your location' ? 'near you' : 'around Abuja city centre'}
                </span>
              </h2>
              <div className="mt-2"><Explanation data={state.data} user={user} /></div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-quiet !py-2" onClick={geo.locate} disabled={geo.status === 'locating'}>
                {geo.status === 'locating' ? 'Finding you…' : origin.label === 'Your location' ? 'Update my location' : 'Use my location'}
              </button>
              <label htmlFor="rec-radius" className="sr-only">Distance</label>
              <select id="rec-radius" className="field !w-auto !py-2" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
                {RADII.map((r) => <option key={r} value={r}>Within {r} km</option>)}
              </select>
              <div className="flex rounded-md border border-granite-200 bg-surface p-0.5" role="tablist" aria-label="Recommendations view">
                {['list', 'map'].map((v) => (
                  <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                    className={`rounded px-3 py-1.5 text-sm font-semibold ${view === v ? 'bg-granite-900 text-white' : 'text-granite-700 hover:bg-granite-100'}`}>
                    {v === 'list' ? 'List' : 'Map'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(notice || geo.error) && (
            <p role="status" className="mt-4 rounded-md bg-laterite-50 px-4 py-2.5 text-sm text-laterite-600">{notice || geo.error}</p>
          )}
          {state.error && <p role="alert" className="mt-4 text-danger">{state.error}</p>}

          {state.loading && !state.data && (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading recommendations">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="h-72 animate-pulse rounded-lg border border-granite-200 bg-granite-100/60" />
              ))}
            </ul>
          )}

          {!state.loading && state.data && items.length === 0 && (
            <div className="mt-6 rounded-lg border border-dashed border-granite-200 p-6">
              <p className="font-semibold">No attractions within {radius} km.</p>
              <p className="mt-1 text-granite-700">Choose a larger distance, or try Explore to search from another point.</p>
            </div>
          )}

          {items.length > 0 && view === 'list' && (
            <ol className={`mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${state.loading ? 'opacity-60' : ''}`}>
              {items.map((a) => (
                <li key={a.attraction_id}>
                  <AttractionCard attraction={a} onOpen={open(a)} state={linkState} />
                </li>
              ))}
            </ol>
          )}

          {items.length > 0 && view === 'map' && (
            <MapView
              center={origin}
              markers={markers}
              userPosition={origin}
              fitToMarkers
              className="mt-6 h-[520px]"
              renderPopup={(m) => (
                <div className="min-w-44">
                  <p className="text-[15px] font-semibold text-granite-900">{m.a.rank}. {m.name}</p>
                  <p className="mt-0.5 text-granite-700">{m.a.category_name} · {km(m.a.distance_km)}</p>
                  <Link to={`/attractions/${m.id}`} state={linkState} onClick={open(m.a)} className="mt-2 inline-block font-semibold !text-green-700">
                    View details →
                  </Link>
                </div>
              )}
            />
          )}

          {state.data && state.data.total > SHOW && (
            <p className="mt-6 text-granite-700">
              Showing the top {SHOW} of {state.data.total}.{' '}
              <Link to="/explore" className="font-semibold text-green-700 underline-offset-2 hover:underline">See them all on Explore</Link>
            </p>
          )}
        </div>
      </section>
    </>
  );
}
