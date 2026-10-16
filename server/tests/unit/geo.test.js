const { insideFCT, boundingBox, withinRadius } = require('../../src/lib/geo');
const { haversineKm } = require('../../src/lib/haversine');

const box = { minLat: 8.3, maxLat: 9.4, minLng: 6.7, maxLng: 7.7 };

describe('insideFCT', () => {
  test('accepts central Abuja', () => expect(insideFCT(9.0579, 7.4951, box)).toBe(true));
  test('rejects Lagos', () => expect(insideFCT(6.5244, 3.3792, box)).toBe(false));
  test('rejects Kano', () => expect(insideFCT(12.0022, 8.592, box)).toBe(false));
});

describe('boundingBox', () => {
  test('contains every point on the circle edge', () => {
    const [lat, lng, r] = [9.0579, 7.4951, 10];
    const b = boundingBox(lat, lng, r);
    for (let bearing = 0; bearing < 360; bearing += 15) {
      const rad = (bearing * Math.PI) / 180;
      const pLat = lat + (r / 111.32) * Math.cos(rad) * 0.999;
      const pLng = lng + ((r / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(rad)) * 0.999;
      expect(pLat).toBeGreaterThanOrEqual(b.minLat);
      expect(pLat).toBeLessThanOrEqual(b.maxLat);
      expect(pLng).toBeGreaterThanOrEqual(b.minLng);
      expect(pLng).toBeLessThanOrEqual(b.maxLng);
    }
  });
});

describe('withinRadius', () => {
  const rows = [
    { name: 'near', latitude: 9.06, longitude: 7.49 },
    { name: 'far', latitude: 9.29, longitude: 7.41 },
    { name: 'mid', latitude: 9.1, longitude: 7.45 },
  ];
  test('drops points beyond the radius and sorts nearest first', () => {
    const out = withinRadius(rows, 9.0579, 7.4951, 10);
    expect(out.map((r) => r.name)).toEqual(['near', 'mid']);
    expect(out[0].distance_km).toBeCloseTo(haversineKm(9.0579, 7.4951, 9.06, 7.49), 10);
  });
});
