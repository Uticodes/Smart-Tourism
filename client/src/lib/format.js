/** 0.45 → "450 m", 3.27 → "3.3 km" */
export const km = (d) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`);

/** Same approximate box as the server's FCT check. */
export const inFCT = (p) => p.lat >= 8.3 && p.lat <= 9.4 && p.lng >= 6.7 && p.lng <= 7.7;

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
