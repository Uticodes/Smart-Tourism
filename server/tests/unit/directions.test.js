const { directionsUrl } = require('../../src/lib/directions');

describe('directionsUrl()', () => {
  test('builds a Google Maps directions link to the attraction', () => {
    const url = new URL(directionsUrl(9.0765, 7.3986));
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('destination')).toBe('9.076500,7.398600');
    expect(url.searchParams.has('origin')).toBe(false); // Google Maps starts from the device location
  });
  test('accepts DECIMAL strings from MySQL and an optional travel mode', () => {
    const url = new URL(directionsUrl('9.057900', '7.495100', { travelmode: 'walking' }));
    expect(url.searchParams.get('destination')).toBe('9.057900,7.495100');
    expect(url.searchParams.get('travelmode')).toBe('walking');
  });
  test('refuses missing coordinates', () => {
    expect(() => directionsUrl(null, 'x')).toThrow();
  });
});
