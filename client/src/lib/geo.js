/** Small geometry helpers for in-app navigation (metres, WGS84). */
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export function metres(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distance from p to the segment a–b, on a local flat projection (accurate to centimetres at city scale). */
function toSegment(p, a, b) {
  const k = Math.cos(rad(p.lat));
  const ax = (a.lng - p.lng) * k, ay = a.lat - p.lat;
  const bx = (b.lng - p.lng) * k, by = b.lat - p.lat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
  const x = ax + t * dx, y = ay + t * dy;
  return Math.sqrt(x * x + y * y) * (Math.PI / 180) * R;
}

/** Shortest distance in metres from a point to a path of {lat, lng}. */
export function distanceToPath(p, path) {
  if (!path?.length) return Infinity;
  if (path.length === 1) return metres(p, path[0]);
  let best = Infinity;
  for (let i = 1; i < path.length; i++) best = Math.min(best, toSegment(p, path[i - 1], path[i]));
  return best;
}

export function formatDistance(m) {
  if (m == null) return '';
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 9500 ? 1 : 0)} km`;
}

export function formatDuration(ms) {
  if (ms == null) return '';
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}
