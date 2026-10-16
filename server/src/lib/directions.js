/**
 * FR-07: "Get Directions" hands navigation over to Google Maps.
 * The Maps URLs format needs no API key. On a phone it opens the Google Maps app
 * (or the browser if the app is not installed); the route starts from the device's location.
 * https://developers.google.com/maps/documentation/urls/get-started#directions-action
 */
function directionsUrl(lat, lng, { travelmode } = {}) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) throw new Error('directionsUrl needs numeric coordinates');
  const params = new URLSearchParams({ api: '1', destination: `${la.toFixed(6)},${ln.toFixed(6)}` });
  if (travelmode) params.set('travelmode', travelmode);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

module.exports = { directionsUrl };
