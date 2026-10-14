const { haversineKm } = require('../../src/lib/haversine');

describe('haversineKm', () => {
  test('distance from a point to itself is zero', () => {
    expect(haversineKm(9.0579, 7.4951, 9.0579, 7.4951)).toBe(0);
  });

  test('one degree of latitude is about 111.2 km', () => {
    expect(haversineKm(9, 7, 10, 7)).toBeCloseTo(111.19, 1);
  });

  test('is symmetric', () => {
    const a = haversineKm(9.06083, 7.48972, 9.05194, 7.49444);
    const b = haversineKm(9.05194, 7.49444, 9.06083, 7.48972);
    expect(a).toBeCloseTo(b, 10);
  });

  test('National Mosque to National Christian Centre is roughly 1.1 km', () => {
    const d = haversineKm(9.06083, 7.48972, 9.05194, 7.49444);
    expect(d).toBeGreaterThan(1.0);
    expect(d).toBeLessThan(1.2);
  });

  test('Abuja to Lagos is roughly 530 km', () => {
    const d = haversineKm(9.0579, 7.4951, 6.5244, 3.3792);
    expect(d).toBeGreaterThan(510);
    expect(d).toBeLessThan(550);
  });
});
