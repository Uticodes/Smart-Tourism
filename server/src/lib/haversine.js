const EARTH_RADIUS_KM = 6371; // Earth's mean radius (Section 3.7.2)

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance between two points on the Earth (Haversine formula).
 * @param {number} lat1 Latitude of origin, in degrees.
 * @param {number} lon1 Longitude of origin, in degrees.
 * @param {number} lat2 Latitude of destination, in degrees.
 * @param {number} lon2 Longitude of destination, in degrees.
 * @returns {number} Distance in kilometres.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

module.exports = { haversineKm, EARTH_RADIUS_KM };
