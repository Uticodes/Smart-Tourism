const additions = require('../../data/abuja-additions.json');
const catalog = require('../../data/attractions.json');
const { attractionSchema } = require('../../src/modules/attractions/attractions.schemas');

it('contains 50 distinct curated places, including the nine researched additions', () => {
  expect(catalog).toHaveLength(50);
  expect(additions).toHaveLength(9);
  const names = catalog.map((a) => a.name.trim().toLowerCase());
  expect(new Set(names).size).toBe(50);
  for (const place of additions) {
    expect(names).toContain(place.name.toLowerCase());
    expect(place.verified).toBe(true);
    expect(place.latitude).toBeGreaterThanOrEqual(8.3);
    expect(place.latitude).toBeLessThanOrEqual(9.4);
    expect(place.longitude).toBeGreaterThanOrEqual(6.7);
    expect(place.longitude).toBeLessThanOrEqual(7.7);
    expect(place.address).toMatch(/Abuja, FCT$/);
    expect(place.coord_source).toMatch(/^https:\/\/www.openstreetmap.org\/(way|node|relation)\//);
    expect(place.verification_sources.length).toBeGreaterThanOrEqual(2);
  }
});

it('allows an existing catalog photo to survive editing through the admin form', () => {
  expect(attractionSchema.parse({
    name: 'Jabi Lake Mall', category_id: 1, latitude: 9.076454, longitude: 7.425218,
    image_url: '/photos/places/jabi-lake-mall.webp',
  }).image_url).toBe('/photos/places/jabi-lake-mall.webp');
});
