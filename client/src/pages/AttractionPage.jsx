import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import MapView from '../components/map/MapView.jsx';
import Stars from '../components/Stars.jsx';
import CategoryArt from '../components/CategoryArt.jsx';
import ReviewsSection from '../components/reviews/ReviewsSection.jsx';
import { fetchAttraction } from '../api/attractions.js';
import { errorMessage } from '../api/client.js';
import { formatDate, km } from '../lib/format.js';

// Straight-line distance, only for the "x km from …" line. Google Maps gives the road distance.
function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function Gallery({ attraction: a }) {
  const [index, setIndex] = useState(0);
  const photos = a.photos || [];
  if (photos.length === 0) {
    return <CategoryArt category={a.category_name} community={a.source === 'community'} className="aspect-[16/9] w-full rounded-lg" />;
  }
  return (
    <div>
      <img src={photos[index]} alt={`${a.name}, photo ${index + 1} of ${photos.length}`} className="aspect-[16/9] w-full rounded-lg bg-granite-100 object-cover" />
      {photos.length > 1 && (
        <div className="mt-2 flex gap-2">
          {photos.map((src, i) => (
            <button key={src} type="button" onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === index}
              className={`h-16 w-24 overflow-hidden rounded-md border-2 ${i === index ? 'border-green-600' : 'border-transparent opacity-70 hover:opacity-100'}`}>
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AttractionPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const origin = location.state?.origin;
  const [state, setState] = useState({ loading: true, error: '', attraction: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: '', attraction: null });
    fetchAttraction(id)
      .then((attraction) => !cancelled && setState({ loading: false, error: '', attraction }))
      .catch((err) => !cancelled && setState({ loading: false, error: errorMessage(err), attraction: null }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (state.attraction) document.title = `${state.attraction.name} · Discover Abuja`;
    return () => { document.title = 'Discover Abuja'; };
  }, [state.attraction]);

  // Back goes to wherever the visitor came from (Home or Explore); a shared link goes to Explore.
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate('/explore'));

  if (state.loading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-busy="true">
        <div className="h-6 w-40 animate-pulse rounded bg-granite-100" />
        <div className="mt-4 h-10 w-2/3 animate-pulse rounded bg-granite-100" />
        <div className="mt-6 aspect-[16/9] w-full max-w-3xl animate-pulse rounded-lg bg-granite-100" />
      </section>
    );
  }

  if (state.error) {
    return (
      <section className="mx-auto max-w-xl px-4 py-20 sm:px-6">
        <h1 className="text-3xl">Attraction not found</h1>
        <p className="mt-3 text-granite-700">{state.error}</p>
        <Link to="/explore" className="btn-primary mt-6">Go to Explore</Link>
      </section>
    );
  }

  const a = state.attraction;
  // Keep the header stars in step when the visitor adds, edits or deletes their review.
  const onSummary = (summary) => setState((s) => ({ ...s, attraction: { ...s.attraction, avg_rating: summary.avg_rating, review_count: summary.count } }));
  const point = { lat: Number(a.latitude), lng: Number(a.longitude) };
  const community = a.source === 'community';
  const distance = origin ? haversineKm(origin, point) : null;

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <button type="button" onClick={back} className="text-sm font-semibold text-granite-700 hover:text-green-700">
        ← Back
      </button>

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-granite-100 px-2.5 py-1 font-semibold text-granite-700">{a.category_name}</span>
          {community && <span className="community-badge">Community-discovered</span>}
        </div>
        <h1 className="mt-3 text-3xl leading-tight sm:text-5xl">{a.name}</h1>
        {community && a.community?.local_name && (
          <p className="mt-1 text-lg text-granite-700">Known locally as {a.community.local_name}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-granite-700">
          <Stars value={a.avg_rating} count={a.review_count || null} />
          {distance != null && <span>{km(distance)} from {origin.label === 'Your location' ? 'you' : origin.label === 'Chosen point' ? 'your chosen point' : origin.label || 'your search point'} (straight line)</span>}
        </div>
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="min-w-0">
          <Gallery attraction={a} />

          {community && a.community && (
            <p className="mt-4 rounded-md border border-laterite-50 bg-laterite-50/60 px-4 py-3 text-sm text-laterite-600">
              Reported by {a.community.contributor || 'a local contributor'}
              {a.community.verified_at && <> · approved {formatDate(a.community.verified_at)}</>}. Local knowledge, checked by an administrator.
            </p>
          )}

          <section className="mt-8">
            <h2 className="text-xl">About</h2>
            <p className="mt-2 whitespace-pre-line text-[17px] leading-relaxed text-granite-900">
              {a.description || 'No description has been added yet.'}
            </p>
          </section>

          <ReviewsSection attractionId={a.attraction_id} onSummary={onSummary} />
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-granite-200 bg-surface p-5">
            <h2 className="text-lg">Getting there</h2>
            {a.address && <p className="mt-1 text-granite-700">{a.address}</p>}
            {community && a.community?.access_notes && (
              <p className="mt-2 text-sm text-granite-700"><span className="font-semibold">Access: </span>{a.community.access_notes}</p>
            )}
            <a href={a.directions_url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 w-full">
              Get directions
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 4h8v8M16 4 5 15" /></svg>
            </a>
            <p className="mt-2 text-xs text-granite-500">Opens Google Maps with a route from where you are.</p>
          </div>
          <MapView
            center={point}
            zoom={15}
            markers={[{ id: a.attraction_id, ...point, name: a.name, source: a.source }]}
            selectedId={a.attraction_id}
            userPosition={origin ? { ...origin } : undefined}
            fitToMarkers={Boolean(origin)}
            className="mt-4 h-[300px]"
          />
        </aside>
      </div>
    </article>
  );
}
