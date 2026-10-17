import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Stars from '../Stars.jsx';
import TextArea from '../TextArea.jsx';
import StarInput from './StarInput.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { createReview, deleteReview, fetchReviews, updateReview } from '../../api/reviews.js';
import { errorMessage, fieldErrors } from '../../api/client.js';
import { formatDate } from '../../lib/format.js';

/** Five horizontal bars, one per star level. One hue: the bars show magnitude, not identity. */
function Distribution({ summary }) {
  const max = Math.max(1, ...Object.values(summary.distribution));
  return (
    <dl className="w-full max-w-xs space-y-1.5">
      {[5, 4, 3, 2, 1].map((n) => {
        const count = summary.distribution[n];
        return (
          <div key={n} className="flex items-center gap-2 text-sm">
            <dt className="w-12 shrink-0 text-granite-700">{n} star{n > 1 ? 's' : ''}</dt>
            <dd className="flex flex-1 items-center gap-2">
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-granite-100">
                <span className="block h-full rounded-full bg-[#B7791F]" style={{ width: `${(count / max) * 100}%` }} />
              </span>
              <span className="w-6 text-right tabular-nums text-granite-700">{count}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function ReviewForm({ attractionId, existing, onSaved, onCancel }) {
  const [rating, setRating] = useState(existing?.rating || 0);
  const [comment, setComment] = useState(existing?.comment || '');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!rating) {
      setErrors({ rating: 'Choose a rating from 1 to 5 stars.' });
      return;
    }
    setBusy(true);
    setError('');
    setErrors({});
    try {
      const data = { rating, comment: comment.trim() || null };
      onSaved(existing ? await updateReview(attractionId, data) : await createReview(attractionId, data));
    } catch (err) {
      const f = fieldErrors(err);
      setErrors(f);
      if (!Object.keys(f).length) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-lg border border-granite-200 bg-surface p-5">
      <h3 className="text-lg">{existing ? 'Edit your review' : 'Write a review'}</h3>
      <div className="mt-3 space-y-4">
        <StarInput value={rating} onChange={(n) => { setRating(n); setErrors({}); }} error={errors.rating} />
        <TextArea id="review-comment" label="What was it like? (optional)" value={comment} onChange={(e) => setComment(e.target.value)}
          error={errors.comment} maxLength={1000} rows={3} hint="Opening times, how busy it was, what to bring" />
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : existing ? 'Save changes' : 'Post review'}</button>
        {onCancel && <button type="button" className="btn-quiet" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

function ReviewItem({ review: r, onEdit, onDelete, busy }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">{r.is_mine ? 'You' : r.author}</span>
        <Stars value={r.rating} />
        <span className="text-sm text-granite-500">{formatDate(r.created_at)}</span>
      </div>
      {r.comment && <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed">{r.comment}</p>}
      {r.is_mine && (
        <div className="mt-2 flex gap-3 text-sm font-semibold">
          {confirming ? (
            <>
              <span className="text-granite-700">Delete your review?</span>
              <button type="button" className="text-danger hover:underline" onClick={onDelete} disabled={busy}>Delete</button>
              <button type="button" className="text-granite-700 hover:underline" onClick={() => setConfirming(false)}>Keep it</button>
            </>
          ) : (
            <>
              <button type="button" className="text-green-700 hover:underline" onClick={onEdit}>Edit</button>
              <button type="button" className="text-granite-700 hover:underline" onClick={() => setConfirming(true)}>Delete</button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** FR-08: rating summary, the visitor's own review form, and every review newest first. */
export default function ReviewsSection({ attractionId, onSummary }) {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchReviews(attractionId)
      .then((data) => !cancelled && setState({ loading: false, error: '', data }))
      .catch((err) => !cancelled && setState({ loading: false, error: errorMessage(err), data: null }));
    return () => { cancelled = true; };
  }, [attractionId, user?.user_id]);

  function apply(data) {
    setState({ loading: false, error: '', data });
    setEditing(false);
    onSummary?.(data.summary);
  }

  async function remove() {
    setBusy(true);
    try {
      apply(await deleteReview(attractionId));
    } catch (err) {
      setState((s) => ({ ...s, error: errorMessage(err) }));
    } finally {
      setBusy(false);
    }
  }

  const d = state.data;
  return (
    <section className="mt-10" aria-labelledby="reviews">
      <h2 id="reviews" className="text-xl">Reviews</h2>
      {state.loading && <p className="mt-2 text-granite-500">Loading reviews…</p>}
      {state.error && <p role="alert" className="mt-2 text-danger">{state.error}</p>}

      {d && (
        <>
          {d.summary.count > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-10 gap-y-4 rounded-lg border border-granite-200 bg-surface p-5">
              <div>
                <p className="text-5xl font-bold leading-none">{Number(d.summary.avg_rating).toFixed(1)}</p>
                <div className="mt-2"><Stars value={d.summary.avg_rating} /></div>
                <p className="mt-1 text-sm text-granite-700">{d.summary.count} {d.summary.count === 1 ? 'review' : 'reviews'}</p>
              </div>
              <Distribution summary={d.summary} />
            </div>
          )}

          <div className="mt-4">
            {!user && (
              <p className="rounded-lg border border-dashed border-granite-200 p-5 text-granite-700">
                {d.summary.count === 0 ? 'Nobody has reviewed this place yet. ' : ''}
                <Link to="/login" state={{ from: `/attractions/${attractionId}` }} className="font-semibold text-green-700 hover:underline">Sign in</Link> to write a review.
              </p>
            )}
            {user && !d.my_review && <ReviewForm attractionId={attractionId} onSaved={apply} />}
            {user && d.my_review && editing && (
              <ReviewForm attractionId={attractionId} existing={d.my_review} onSaved={apply} onCancel={() => setEditing(false)} />
            )}
          </div>

          {d.reviews.length > 0 && (
            <ul className="mt-2 divide-y divide-granite-200">
              {d.reviews.map((r) => (
                <ReviewItem key={r.review_id} review={r} busy={busy} onEdit={() => setEditing(true)} onDelete={remove} />
              ))}
            </ul>
          )}
          {user && d.summary.count === 0 && <p className="mt-3 text-sm text-granite-500">Be the first to review this place.</p>}
        </>
      )}
    </section>
  );
}
