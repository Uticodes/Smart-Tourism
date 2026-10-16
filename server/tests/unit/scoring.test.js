const { score, rank, categoryPart, ratingPart, proximityPart, WEIGHTS } = require('../../src/lib/scoring');

describe('recommendation score parts', () => {
  test('weights add up to 1', () => {
    expect(WEIGHTS.category + WEIGHTS.rating + WEIGHTS.proximity).toBeCloseTo(1, 10);
  });
  test('category match is 1.0 for a chosen category and 0.3 otherwise', () => {
    const prefs = new Set([2]);
    expect(categoryPart(2, prefs)).toBe(1);
    expect(categoryPart('2', prefs)).toBe(1);
    expect(categoryPart(3, prefs)).toBe(0.3);
    expect(categoryPart(3, new Set())).toBe(0.3);
  });
  test('rating is avg ÷ 5, and 0.5 when unrated', () => {
    expect(ratingPart(5)).toBe(1);
    expect(ratingPart('4.0')).toBeCloseTo(0.8);
    expect(ratingPart(null)).toBe(0.5);
  });
  test('proximity is 1 at the search point, 0 at the edge, never negative', () => {
    expect(proximityPart(0, 10)).toBe(1);
    expect(proximityPart(5, 10)).toBe(0.5);
    expect(proximityPart(10, 10)).toBe(0);
    expect(proximityPart(12, 10)).toBe(0);
  });
});

describe('score()', () => {
  test('worked example from Chapter 3: matching category, 4.0 stars, 2 km of 10 km', () => {
    // 0.4 × 1.0 + 0.3 × 0.8 + 0.3 × 0.8 = 0.88
    const s = score({ category_id: 1, avg_rating: 4.0 }, new Set([1]), 2, 10);
    expect(s.score).toBeCloseTo(0.88, 3);
    expect(s.parts).toEqual({ category: 1, rating: 0.8, proximity: 0.8 });
  });
  test('always between 0 and 1', () => {
    expect(score({ category_id: 1, avg_rating: 5 }, new Set([1]), 0, 10).score).toBe(1);
    expect(score({ category_id: 9, avg_rating: 0 }, new Set([1]), 10, 10).score).toBeCloseTo(0.12, 3);
  });
});

describe('rank()', () => {
  const items = [
    { attraction_id: 1, category_id: 1, avg_rating: null, distance_km: 3 },
    { attraction_id: 2, category_id: 2, avg_rating: null, distance_km: 1 },
    { attraction_id: 3, category_id: 2, avg_rating: null, distance_km: 3 },
  ];
  test('sorts by score, adds rank 1..n and marks preference matches', () => {
    const r = rank(items, new Set([1]), 10);
    expect(r.map((a) => a.attraction_id)).toEqual([1, 2, 3]);
    expect(r.map((a) => a.rank)).toEqual([1, 2, 3]);
    expect(r[0].matches_preference).toBe(true);
    expect(r[1].matches_preference).toBe(false);
  });
  test('with no preferences, ties on category and rating go to the nearer place', () => {
    const r = rank(items, new Set(), 10);
    expect(r[0].attraction_id).toBe(2);
  });
});
