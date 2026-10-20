import { useId } from 'react';

// Map pins drawn as inline SVG inside Google's Advanced Markers.
// Green = curated attraction, laterite = community-discovered, grey = unverified report.
// The selected pin stands up, glows and carries a dark name label (styles in index.css).
const PALETTES = {
  curated: { main: '#0A7A4B', top: '#0E9F6E', dark: '#075C39', beacon: 'rgba(10, 122, 75, 0.45)' },
  community: { main: '#9A3F22', top: '#B84E2D', dark: '#7A2E16', beacon: 'rgba(154, 63, 34, 0.45)' },
  pending: { main: '#78818A', top: '#9CA3AF', dark: '#4A525B', beacon: 'rgba(120, 129, 138, 0.45)' },
};
export const PIN_COLORS = Object.fromEntries(Object.entries(PALETTES).map(([k, v]) => [k, v.main]));

export function AttractionPin({ source = 'curated', selected = false, label }) {
  const gradId = useId();
  const p = PALETTES[source] || PALETTES.curated;

  if (selected) {
    // 44 × 56 pin whose tip sits 6px above the box bottom; translateY puts the tip on the exact point.
    return (
      <div className="map-pin map-pin-selected relative" style={{ width: 44, height: 56, transform: 'translateY(6px)' }}>
        {label && <span className="pin-label">{label}</span>}
        <span className="pin-beacon" style={{ '--beacon-color': p.beacon }} />
        <svg className="pin-svg absolute left-0 top-0" width="44" height="56" viewBox="0 0 44 56" aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.top} />
              <stop offset="100%" stopColor={p.dark} />
            </linearGradient>
          </defs>
          <ellipse cx="22" cy="51" rx="8" ry="2.5" fill="rgba(43, 48, 54, 0.35)" />
          <path d="M 22 49 C 21 46, 7 27, 7 18 A 15 15 0 1 1 37 18 C 37 27, 23 46, 22 49 Z" fill={`url(#${gradId})`} stroke="#ffffff" strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="22" cy="18" r="8" fill="#ffffff" />
          <path d="M22 13 L23.3 16.2 L26.8 16.4 L24.1 18.7 L24.9 22.1 L22 20.3 L19.1 22.1 L19.9 18.7 L17.2 16.4 L20.7 16.2 Z" fill={p.dark} />
        </svg>
      </div>
    );
  }

  return (
    <div className="map-pin" style={{ width: 30, height: 30 }}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 2c-6 0-10.5 4.6-10.5 10.4C5.5 20.3 16 30 16 30s10.5-9.7 10.5-17.6C26.5 6.6 22 2 16 2z" fill={p.main} stroke="#fff" strokeWidth="2" />
        <circle cx="16" cy="12.5" r="4" fill="#fff" />
      </svg>
    </div>
  );
}

/** The blue "you are here" dot. With a heading (degrees) it shows which way you're moving. */
export function UserDot({ heading = null }) {
  return (
    <span className="relative block h-5 w-5">
      {heading != null && (
        <svg viewBox="0 0 40 40" className="absolute -left-2.5 -top-2.5 h-10 w-10" style={{ transform: `rotate(${heading}deg)` }} aria-hidden="true">
          <path d="M20 2 27 15H13z" fill="#2B6CB0" opacity="0.85" />
        </svg>
      )}
      <span className="user-dot absolute inset-0" aria-hidden="true" />
    </span>
  );
}
