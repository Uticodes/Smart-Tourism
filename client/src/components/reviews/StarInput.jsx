import { useState } from 'react';

const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/**
 * 1–5 star picker built on native radio buttons, so arrow keys, Tab and screen readers work.
 * Hovering previews a rating; the word beside the stars says what the number means.
 */
export default function StarInput({ value, onChange, error, name = 'rating' }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset>
      <legend className="label">Your rating</legend>
      <div className="flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(n)}>
              <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
              <svg viewBox="0 0 24 24" aria-hidden="true"
                className={`h-8 w-8 rounded transition-colors peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-green-600 ${n <= shown ? 'text-[#B7791F]' : 'text-granite-200'}`}>
                <path fill="currentColor" d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z" />
              </svg>
              <span className="sr-only">{n} {n === 1 ? 'star' : 'stars'}, {WORDS[n]}</span>
            </label>
          ))}
        </div>
        <span className="min-w-20 text-[15px] font-semibold text-granite-700" aria-hidden="true">{WORDS[shown]}</span>
      </div>
      {error && <p className="mt-1.5 text-sm text-danger" role="alert">{error}</p>}
    </fieldset>
  );
}
