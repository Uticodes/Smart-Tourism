import { Link } from 'react-router-dom';
import Stars from './Stars.jsx';
import CategoryArt from './CategoryArt.jsx';
import { km } from '../lib/format.js';

/** A recommendation card: thumbnail, name, category, distance, rating, badges. */
export default function AttractionCard({ attraction: a, onOpen, state }) {
  const community = a.source === 'community';
  return (
    <Link
      to={`/attractions/${a.attraction_id}`}
      state={state}
      onClick={onOpen}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-granite-200 bg-surface transition-colors hover:border-granite-500"
    >
      {a.image_url ? (
        <img src={a.image_url} alt="" loading="lazy" className="aspect-[2/1] w-full object-cover" />
      ) : (
        <CategoryArt category={a.category_name} community={community} className="aspect-[2/1] w-full" />
      )}
      {a.photo_credit && (
        <p className="truncate px-4 pt-2 text-[11px] text-granite-500" title={`Photo: ${a.photo_credit.author}${a.photo_credit.license ? ` · ${a.photo_credit.license}` : ''}. Full credits on the place page.`}>
          Photo: {a.photo_credit.author}{a.photo_credit.license ? ` · ${a.photo_credit.license}` : ''}
        </p>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[17px] leading-snug group-hover:text-green-700">{a.name}</h3>
          <span className="shrink-0 text-sm font-semibold text-granite-700">{km(a.distance_km)}</span>
        </div>
        <p className="mt-1 text-sm text-granite-700">{a.category_name}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-3">
          <Stars value={a.avg_rating} count={a.review_count || null} />
          {a.matches_preference && (
            <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
              Matches your interests
            </span>
          )}
          {community && <span className="community-badge">Community-discovered</span>}
        </div>
      </div>
    </Link>
  );
}
