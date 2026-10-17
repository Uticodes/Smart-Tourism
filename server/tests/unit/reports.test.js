const { nearestWithin } = require('../../src/lib/geo');
const { afterResponse, canAdminDecide } = require('../../src/lib/reportStatus');

describe('nearestWithin', () => {
  const rows = [
    { id: 'far', latitude: 9.0700, longitude: 7.4951 },  // ~1.35 km north
    { id: 'near', latitude: 9.0586, longitude: 7.4951 }, // ~78 m north
    { id: 'mid', latitude: 9.0600, longitude: 7.4951 },  // ~234 m north
  ];
  test('returns the closest row and its distance in metres', () => {
    const hit = nearestWithin(rows, 9.0579, 7.4951, 1000);
    expect(hit.row.id).toBe('near');
    expect(hit.distance_m).toBeGreaterThan(70);
    expect(hit.distance_m).toBeLessThan(85);
  });
  test('ignores rows beyond the limit', () => {
    expect(nearestWithin(rows, 9.0579, 7.4951, 50)).toBeNull();
    expect(nearestWithin([], 9.0579, 7.4951, 150)).toBeNull();
  });
  test('accepts DECIMAL strings from MySQL', () => {
    expect(nearestWithin([{ latitude: '9.0586', longitude: '7.4951' }], 9.0579, 7.4951, 150)).not.toBeNull();
  });
});

describe('report status rules', () => {
  const base = { status: 'pending', confirm_count: 0, flag_count: 0, is_hidden: false };
  test('three confirmations move pending to under_review', () => {
    expect(afterResponse({ ...base, confirm_count: 2 }).status).toBe('pending');
    expect(afterResponse({ ...base, confirm_count: 3 }).status).toBe('under_review');
  });
  test('confirmations never change a needs_info report', () => {
    expect(afterResponse({ ...base, status: 'needs_info', confirm_count: 5 }).status).toBe('needs_info');
  });
  test('a report is hidden at 3 flags only when flags outnumber confirmations', () => {
    expect(afterResponse({ ...base, flag_count: 2 }).is_hidden).toBe(false);
    expect(afterResponse({ ...base, flag_count: 3, confirm_count: 3 }).is_hidden).toBe(false);
    expect(afterResponse({ ...base, flag_count: 3, confirm_count: 2 }).is_hidden).toBe(true);
    expect(afterResponse({ ...base, flag_count: 0, is_hidden: true }).is_hidden).toBe(true);
  });
  test('admins can decide open reports only; approved and rejected are final', () => {
    for (const s of ['pending', 'under_review', 'needs_info']) expect(canAdminDecide(s)).toBe(true);
    for (const s of ['approved', 'rejected']) expect(canAdminDecide(s)).toBe(false);
  });
});
