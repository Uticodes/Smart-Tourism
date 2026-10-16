const env = require('../config/env');
const { haversineKm } = require('./haversine');

const KM_PER_DEGREE_LAT = 111.32;

/** True when the point is inside the configured (approximate) FCT bounding box. */
function insideFCT(lat, lng, box = env.fct) {
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
}

/**
 * Latitude/longitude box that fully contains a circle of radiusKm around a point.
 * Used as a cheap, index-friendly SQL pre-filter before the exact Haversine check.
 */
function boundingBox(lat, lng, radiusKm) {
  const dLat = radiusKm / KM_PER_DEGREE_LAT;
  const dLng = radiusKm / (KM_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

/** Keeps the rows within radiusKm of the point, adds distance_km and sorts nearest first. */
function withinRadius(rows, lat, lng, radiusKm) {
  return rows
    .map((r) => ({ ...r, distance_km: haversineKm(lat, lng, Number(r.latitude), Number(r.longitude)) }))
    .filter((r) => r.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km);
}

module.exports = { insideFCT, boundingBox, withinRadius, ABUJA_CENTRE: { lat: 9.0579, lng: 7.4951 } };
