import L from 'leaflet';

// Map pins drawn as inline SVG (no image files, so nothing breaks when bundled).
// Green = curated attraction, laterite = community-discovered, larger when selected.
const COLORS = { curated: '#0A7A4B', community: '#9A3F22', pending: '#78818A' };

export function attractionIcon({ source = 'curated', selected = false } = {}) {
  const fill = COLORS[source] || COLORS.curated;
  const size = selected ? 40 : 30;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2c-6 0-10.5 4.6-10.5 10.4C5.5 20.3 16 30 16 30s10.5-9.7 10.5-17.6C26.5 6.6 22 2 16 2z"
            fill="${fill}" stroke="#fff" stroke-width="2"/>
      <circle cx="16" cy="12.5" r="4" fill="#fff"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: 'map-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size - 1],
    popupAnchor: [0, -size + 4],
  });
}

export const userIcon = L.divIcon({
  html: '<span class="user-dot" aria-hidden="true"></span>',
  className: 'map-pin',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});
