import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import MapView, { ABUJA_CENTRE, MapLine } from '../components/map/MapView.jsx';
import { MAPS_KEY } from '../components/map/MapsProvider.jsx';
import { AttractionPin } from '../components/map/Pins.jsx';
import useGeolocation from '../hooks/useGeolocation.js';
import useWatchPosition from '../hooks/useWatchPosition.js';
import useSimulatedPosition from '../hooks/useSimulatedPosition.js';
import { fetchAttraction } from '../api/attractions.js';
import { errorMessage } from '../api/client.js';
import { inFCT } from '../lib/format.js';
import { distanceToPath, formatDistance, formatDuration, metres } from '../lib/geo.js';

const MODES = [
  { id: 'DRIVING', label: 'Driving', google: 'driving', mps: 9 },  // ~32 km/h, typical Abuja traffic
  { id: 'WALKING', label: 'Walking', google: 'walking', mps: 1.4 },
];
const SPEEDS = [1, 5, 20];
const OFF_ROUTE_M = 50;      // further than this from the line counts as off the route
const REROUTE_GAP_MS = 20000; // at most one new route every 20 seconds
const ARRIVED_M = 35;

const ll = (p) => ({ lat: typeof p.lat === 'function' ? p.lat() : p.lat, lng: typeof p.lng === 'function' ? p.lng() : p.lng });

function Arrow({ maneuver = '' }) {
  const m = maneuver.toUpperCase();
  const char = m.includes('UTURN') ? '↶' : m.includes('ROUNDABOUT') ? '⟳' : m.includes('SLIGHT_LEFT') || m.includes('FORK_LEFT') || m.includes('RAMP_LEFT') ? '↖'
    : m.includes('SLIGHT_RIGHT') || m.includes('FORK_RIGHT') || m.includes('RAMP_RIGHT') ? '↗' : m.includes('LEFT') ? '←' : m.includes('RIGHT') ? '→' : '↑';
  return <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-granite-100 text-lg font-bold text-granite-900">{char}</span>;
}

/** Keeps the camera on the traveller while navigating, or on the whole route otherwise. Dragging the map pauses following. */
function Camera({ follow, me, routePath, onUserMove }) {
  const map = useMap();
  const fitted = useRef(null);
  useEffect(() => {
    if (!map) return undefined;
    const l = map.addListener('dragstart', onUserMove);
    return () => l.remove();
  }, [map, onUserMove]);
  useEffect(() => {
    if (!map) return;
    if (follow && me) {
      map.panTo(me);
      if (map.getZoom() < 16) map.setZoom(17);
    } else if (!follow && routePath?.length && fitted.current !== routePath) {
      const b = new window.google.maps.LatLngBounds();
      routePath.forEach((p) => b.extend(p));
      map.fitBounds(b, 48);
      fitted.current = routePath;
    }
  }, [map, follow, me?.lat, me?.lng, routePath]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function DirectionsPage() {
  const { id } = useParams();
  const location = useLocation();
  const routesLib = useMapsLibrary('routes');
  const geo = useGeolocation();
  const [place, setPlace] = useState({ loading: true, error: '', a: null });
  const [start, setStart] = useState(null);
  const [notice, setNotice] = useState('');
  const [picking, setPicking] = useState(false);
  const [mode, setMode] = useState('DRIVING');
  const [route, setRoute] = useState({ loading: false, error: '', data: null });
  const [navigating, setNavigating] = useState(false);
  const [follow, setFollow] = useState(true);
  const [arrived, setArrived] = useState(false);
  const [rerouteNote, setRerouteNote] = useState('');
  // Demo mode (local development, or ?demo in the address): travel the route without being there.
  const demoAllowed = import.meta.env.DEV || new URLSearchParams(location.search).has('demo');
  const [simulating, setSimulating] = useState(false);
  const [speed, setSpeed] = useState(5);
  const live = useWatchPosition(navigating && !simulating);
  const lastRoute = useRef(0);
  const offCount = useRef(0);

  useEffect(() => {
    fetchAttraction(id)
      .then((a) => setPlace({ loading: false, error: '', a }))
      .catch((err) => setPlace({ loading: false, error: errorMessage(err), a: null }));
    geo.locate();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dest = place.a ? { lat: Number(place.a.latitude), lng: Number(place.a.longitude) } : null;
  const sim = useSimulatedPosition(navigating && simulating, route.data?.path, MODES.find((m) => m.id === mode).mps * speed, dest);

  // Start from the device position when it is inside the FCT; otherwise from the search point or the city centre.
  useEffect(() => {
    if (start || (geo.status !== 'ready' && geo.status !== 'error')) return;
    if (geo.status === 'ready' && inFCT(geo.position)) {
      setStart({ lat: geo.position.lat, lng: geo.position.lng, label: 'Your location' });
    } else {
      const from = location.state?.origin && inFCT(location.state.origin) ? location.state.origin : ABUJA_CENTRE;
      setStart({ lat: from.lat, lng: from.lng, label: from.label || 'Abuja city centre' });
      setNotice(geo.status === 'ready'
        ? `You appear to be outside the FCT, so the route starts from ${from.label || 'Abuja city centre'}. Tap “Choose start” to change it.`
        : `${geo.error} The route starts from ${from.label || 'Abuja city centre'}.`);
    }
  }, [geo.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const compute = useCallback(async (from) => {
    if (!routesLib || !dest || !from) return;
    lastRoute.current = Date.now();
    setRoute((r) => ({ ...r, loading: true, error: '' }));
    try {
      const { routes } = await routesLib.Route.computeRoutes({
        origin: { lat: from.lat, lng: from.lng },
        destination: dest,
        travelMode: mode,
        fields: ['path', 'distanceMeters', 'durationMillis', 'legs', 'viewport', 'description'],
      });
      const r = routes?.[0];
      if (!r) throw new Error('none');
      const steps = (r.legs || []).flatMap((leg) => leg.steps || []).map((s) => ({
        instructions: s.instructions || 'Continue',
        maneuver: s.maneuver || '',
        distance: s.distanceMeters || 0,
        path: (s.path || []).map(ll),
      })).filter((s) => s.path.length);
      setRerouteNote((n) => (n ? 'New route found' : ''));
      setRoute({
        loading: false,
        error: '',
        data: { path: (r.path || []).map(ll), distance: r.distanceMeters, duration: r.durationMillis, via: r.description, steps },
      });
    } catch (err) {
      const none = err.message === 'none' || /ZERO_RESULTS|NOT_FOUND/i.test(err.message || '');
      setRoute({
        loading: false,
        data: null,
        error: none
          ? `Google found no ${mode === 'WALKING' ? 'walking' : 'driving'} route to this place. Try the other mode, or open Google Maps.`
          : /permission|denied|not authorized|API key/i.test(err.message || '')
            ? 'Directions are not enabled for this API key. Turn on the Routes API for it in Google Cloud.'
            : 'Directions could not be loaded. Check your connection and try again.',
      });
    }
  }, [routesLib, dest?.lat, dest?.lng, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (start) compute(start);
  }, [start?.lat, start?.lng, compute]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- live navigation
  const source = simulating ? sim : live;
  const me = navigating && source.position ? source.position : null;
  const progress = useMemo(() => {
    const steps = route.data?.steps;
    if (!me || !steps?.length) return null;
    let index = 0, best = Infinity;
    steps.forEach((s, i) => {
      const d = distanceToPath(me, s.path);
      if (d < best) { best = d; index = i; }
    });
    const step = steps[index];
    const toStepEnd = metres(me, step.path[step.path.length - 1]);
    const remaining = toStepEnd + steps.slice(index + 1).reduce((sum, s) => sum + s.distance, 0);
    return {
      index,
      next: steps[index + 1] || null,
      toStepEnd,
      remaining,
      remainingMs: route.data.distance ? (route.data.duration * remaining) / route.data.distance : null,
      offRoute: distanceToPath(me, route.data.path) > OFF_ROUTE_M && (me.accuracy || 0) < OFF_ROUTE_M,
    };
  }, [me?.lat, me?.lng, route.data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!me || !dest) return;
    const end = route.data?.path?.[route.data.path.length - 1];
    if (metres(me, dest) < ARRIVED_M || (end && metres(me, end) < 20 && metres(me, dest) < 150)) {
      setArrived(true);
      setNavigating(false);
      return;
    }
    // Off the route on two readings in a row: work out a new route from here.
    offCount.current = progress?.offRoute ? offCount.current + 1 : 0;
    // Only re-route from inside the FCT (a real GPS fix in another state would ask for a cross-country route).
    const gap = simulating ? 2000 : REROUTE_GAP_MS;
    if (offCount.current >= 2 && Date.now() - lastRoute.current > gap && inFCT(me)) {
      offCount.current = 0;
      setRerouteNote('Off route: finding a new route…');
      setStart({ lat: me.lat, lng: me.lng, label: 'Your location' });
    }
  }, [me?.lat, me?.lng, me?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rerouteNote !== 'New route found') return undefined;
    const t = setTimeout(() => setRerouteNote(''), 3000);
    return () => clearTimeout(t);
  }, [rerouteNote]);

  // Keep the screen awake while navigating, where the browser allows it.
  useEffect(() => {
    if (!navigating || !('wakeLock' in navigator)) return undefined;
    let lock;
    navigator.wakeLock.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => lock?.release().catch(() => {});
  }, [navigating]);

  function startNavigation(demo = false) {
    setRerouteNote('');
    if (!demo && geo.position && !inFCT(geo.position)) {
      setNotice(demoAllowed
        ? 'You are outside the FCT, so live navigation cannot follow you here. Use “Simulate journey” below to see it work.'
        : 'You are outside the FCT, so live navigation cannot follow you here. Open the route in Google Maps instead.');
      return;
    }
    setSimulating(demo);
    setArrived(false);
    setFollow(true);
    setNavigating(true);
    setPicking(false);
  }

  function locateMe() {
    setNotice('');
    geo.locate();
    setStart(null); // the effect above sets it again when the position arrives
  }

  function pickStart(p) {
    if (!picking) return;
    if (!inFCT(p)) {
      setNotice('That point is outside the FCT. Choose a start point inside the territory.');
      return;
    }
    setStart({ lat: p.lat, lng: p.lng, label: 'Chosen start' });
    setPicking(false);
    setNotice('');
  }

  if (place.loading) return <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><p className="text-granite-500">Loading…</p></section>;
  if (place.error) {
    return (
      <section className="mx-auto max-w-xl px-4 py-20 sm:px-6">
        <h1 className="text-3xl">Attraction not found</h1>
        <p className="mt-3 text-granite-700">{place.error}</p>
        <Link to="/explore" className="btn-primary mt-6">Go to Explore</Link>
      </section>
    );
  }

  const a = place.a;
  const googleUrl = `${a.directions_url}&travelmode=${MODES.find((m) => m.id === mode).google}`;
  const data = route.data;
  const shownStart = me || start;

  return (
    <section className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      <Link to={`/attractions/${a.attraction_id}`} className="text-sm font-semibold text-granite-700 hover:text-green-700">← {a.name}</Link>
      <h1 className="mt-2 text-2xl sm:text-3xl">Directions to {a.name}</h1>

      {!MAPS_KEY ? (
        <div className="mt-4 rounded-lg border border-granite-200 bg-surface p-5">
          <p>In-app directions need a Google Maps key. You can still get directions in Google Maps.</p>
          <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-3">Open in Google Maps</a>
        </div>
      ) : (
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
          <div className="relative min-w-0">
            {navigating && progress && (
              <div className="absolute inset-x-2 top-2 z-10 flex items-center gap-3 rounded-lg bg-granite-900 p-3 text-white shadow-lg" role="status" aria-live="polite">
                <Arrow maneuver={progress.next?.maneuver || route.data.steps[progress.index].maneuver} />
                {rerouteNote ? (
                  <p className="text-[15px] font-bold">{rerouteNote}</p>
                ) : (
                  <div className="min-w-0">
                    <p className="text-lg font-bold leading-tight">{formatDistance(progress.toStepEnd)}</p>
                    <p className="truncate text-sm text-white/85">{progress.next?.instructions || 'Your destination is ahead'}</p>
                  </div>
                )}
              </div>
            )}
            <MapView
              center={start || ABUJA_CENTRE}
              zoom={13}
              userPosition={shownStart ? { ...shownStart, label: me ? 'You' : start?.label } : undefined}
              userHeading={me?.heading ?? null}
              gestureHandling="greedy"
              onMapClick={picking ? pickStart : undefined}
              lines={data ? [{ path: data.path, color: '#2B6CB0', weight: 6, opacity: 0.9 }] : []}
              className={`h-[55vh] min-h-[340px] lg:h-[calc(100vh-11rem)] ${picking ? 'ring-2 ring-green-600' : ''}`}
            >
              {dest && (
                <AdvancedMarker position={dest} title={a.name} zIndex={900}>
                  <AttractionPin source={a.source} selected />
                </AdvancedMarker>
              )}
              <Camera follow={navigating && follow} me={me} routePath={data?.path} onUserMove={() => setFollow(false)} />
            </MapView>
            {navigating && !follow && (
              <button type="button" onClick={() => setFollow(true)} className="btn-primary absolute bottom-6 left-1/2 z-10 -translate-x-1/2 shadow-lg">
                Re-centre
              </button>
            )}
          </div>

          <aside className="min-w-0 space-y-4">
            {arrived && (
              <div role="status" className="rounded-lg bg-green-50 p-4 text-green-700">
                <p className="font-bold">You have arrived at {a.name}.</p>
                <Link to={`/attractions/${a.attraction_id}`} className="mt-1 inline-block font-semibold underline">Leave a review</Link>
              </div>
            )}

            <div className="rounded-lg border border-granite-200 bg-surface p-4">
              <div className="flex rounded-md bg-granite-100 p-0.5" role="radiogroup" aria-label="Travel mode">
                {MODES.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)} disabled={navigating}
                    className={`flex-1 rounded px-3 py-2 text-sm font-semibold ${mode === m.id ? 'bg-surface text-granite-900 shadow-sm' : 'text-granite-700'}`}>
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="mt-4" aria-live="polite">
                {route.loading && <p className="text-granite-500">Finding the route…</p>}
                {route.error && <p className="text-danger">{route.error}</p>}
                {data && !route.loading && (
                  <>
                    <p className="text-3xl font-bold leading-none">
                      {formatDuration(navigating && progress ? progress.remainingMs : data.duration)}
                    </p>
                    <p className="mt-1 text-granite-700">
                      {formatDistance(navigating && progress ? progress.remaining : data.distance)}
                      {data.via && !navigating ? ` · via ${data.via}` : ''}
                    </p>
                  </>
                )}
              </div>

              <p className="mt-3 text-sm text-granite-700">
                From <span className="font-semibold text-granite-900">{me ? (simulating ? 'the simulated position' : 'your live location') : start?.label === 'Your location' ? 'your location' : start?.label || '…'}</span>
              </p>
              {!navigating && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn-quiet !px-3 !py-1.5 !text-sm" onClick={locateMe} disabled={geo.status === 'locating'}>
                    {geo.status === 'locating' ? 'Finding you…' : 'Use my location'}
                  </button>
                  <button type="button" className={`btn-quiet !px-3 !py-1.5 !text-sm ${picking ? '!border-green-600 !text-green-700' : ''}`} onClick={() => setPicking((v) => !v)} aria-pressed={picking}>
                    {picking ? 'Tap the map…' : 'Choose start'}
                  </button>
                </div>
              )}
              {!simulating && (notice || live.error) && <p className="mt-3 rounded-md bg-laterite-50 px-3 py-2 text-sm text-laterite-600">{live.error || notice}</p>}

              <div className="mt-4 flex flex-col gap-2">
                {navigating ? (
                  <button type="button" className="btn-quiet" onClick={() => { setNavigating(false); setSimulating(false); }}>Stop</button>
                ) : (
                  <button type="button" className="btn-primary" onClick={() => startNavigation(false)} disabled={!data}>Start</button>
                )}
                <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="text-center text-sm font-semibold text-green-700 hover:underline">
                  Open in Google Maps for spoken directions ↗
                </a>
              </div>

              {demoAllowed && (
                <div className="mt-4 rounded-md border border-dashed border-granite-500 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-granite-700">Demo</p>
                  <p className="mt-1 text-sm text-granite-700">Travel the route without being there: the dot follows the road at {MODES.find((m) => m.id === mode).label.toLowerCase()} speed.</p>
                  <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Demo speed">
                    {SPEEDS.map((x) => (
                      <button key={x} type="button" role="radio" aria-checked={speed === x} onClick={() => setSpeed(x)}
                        className={`rounded px-2.5 py-1 text-sm font-semibold ${speed === x ? 'bg-granite-900 text-white' : 'text-granite-700 ring-1 ring-granite-200 hover:bg-granite-100'}`}>
                        {x}×
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!navigating && (
                      <button type="button" className="btn-quiet !px-3 !py-1.5 !text-sm" onClick={() => startNavigation(true)} disabled={!data}>Simulate journey</button>
                    )}
                    {navigating && simulating && (
                      <button type="button" className="btn-quiet !px-3 !py-1.5 !text-sm" onClick={sim.offRoute}>Go off route</button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {data?.steps?.length > 0 && (
              <ol className="max-h-[40vh] divide-y divide-granite-100 overflow-y-auto rounded-lg border border-granite-200 bg-surface lg:max-h-[calc(100vh-30rem)]" aria-label="Step-by-step directions">
                {data.steps.map((s, i) => (
                  <li key={i} className={`flex items-start gap-3 p-3 ${progress?.index === i ? 'bg-green-50' : ''}`} aria-current={progress?.index === i ? 'step' : undefined}>
                    <Arrow maneuver={s.maneuver} />
                    <div className="min-w-0">
                      <p className="text-[15px] leading-snug">{s.instructions}</p>
                      <p className="mt-0.5 text-sm text-granite-500">{formatDistance(s.distance)}</p>
                    </div>
                  </li>
                ))}
                <li className="flex items-center gap-3 p-3">
                  <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center"><AttractionPin source={a.source} /></span>
                  <p className="font-semibold">{a.name}</p>
                </li>
              </ol>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
