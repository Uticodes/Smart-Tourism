import L from 'leaflet';

// Map pins drawn as inline SVG (no image files, so nothing breaks when bundled).
// Green = curated attraction, laterite = community-discovered, larger when selected.
const PALETTES = {
  curated: {
    main: '#0A7A4B',
    top: '#0E9F6E',
    dark: '#075C39',
    beacon: 'rgba(10, 122, 75, 0.45)',
  },
  community: {
    main: '#9A3F22',
    top: '#B84E2D',
    dark: '#7A2E16',
    beacon: 'rgba(154, 63, 34, 0.45)',
  },
  pending: {
    main: '#78818A',
    top: '#9CA3AF',
    dark: '#4A525B',
    beacon: 'rgba(120, 129, 138, 0.45)',
  },
};

export function attractionIcon({ source = 'curated', selected = false } = {}) {
  const palette = PALETTES[source] || PALETTES.curated;

  if (selected) {
    const width = 44;
    const height = 56;
    const gradId = `pin-grad-${source}-${Math.random().toString(36).slice(2, 7)}`;
    const html = `
      <div class="pin-container" style="position: relative; width: ${width}px; height: ${height}px;">
        <span class="pin-beacon" style="--beacon-color: ${palette.beacon};"></span>
        <svg class="pin-svg" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 44 56" aria-hidden="true" style="position: absolute; top: 0; left: 0;">
          <defs>
            <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${palette.top}"/>
              <stop offset="100%" stop-color="${palette.dark}"/>
            </linearGradient>
          </defs>
          <ellipse cx="22" cy="51" rx="8" ry="2.5" fill="rgba(43, 48, 54, 0.35)"/>
          <path d="M 22 49 C 21 46, 7 27, 7 18 A 15 15 0 1 1 37 18 C 37 27, 23 46, 22 49 Z"
                fill="url(#${gradId})" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
          <circle cx="22" cy="18" r="8" fill="#ffffff"/>
          <path d="M22 13 L23.3 16.2 L26.8 16.4 L24.1 18.7 L24.9 22.1 L22 20.3 L19.1 22.1 L19.9 18.7 L17.2 16.4 L20.7 16.2 Z"
                fill="${palette.dark}"/>
        </svg>
      </div>`;

    return L.divIcon({
      html,
      className: 'map-pin map-pin-selected',
      iconSize: [width, height],
      iconAnchor: [width / 2, height - 6],
      popupAnchor: [0, -height + 4],
    });
  }

  const size = 30;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2c-6 0-10.5 4.6-10.5 10.4C5.5 20.3 16 30 16 30s10.5-9.7 10.5-17.6C26.5 6.6 22 2 16 2z"
            fill="${palette.main}" stroke="#fff" stroke-width="2"/>
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
